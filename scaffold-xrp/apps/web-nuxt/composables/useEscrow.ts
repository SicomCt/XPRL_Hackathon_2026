/**
 * Smart Escrow: EscrowCreate (bid), EscrowCancel (refund), EscrowFinish (release).
 * Uses XRPL native escrow; platform address = Destination for locked bids.
 */

const TESTNET_WSS = 'wss://s.altnet.rippletest.net:51233'
const XRP_DROPS_PER_XRP = 1_000_000

export interface EscrowCreateResult {
  hash: string
  offerSequence: number
}

export interface EscrowRecord {
  owner: string
  offerSequence: number
  amount: string
  destination: string
  finishAfter?: number
  ledgerIndex?: string
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (error && typeof error === 'object' && 'message' in error) return String((error as { message: unknown }).message)
  return String(error ?? 'Unknown error')
}

/** Get account sequence (needed for EscrowCancel / EscrowFinish). */
async function getAccountSequence(address: string): Promise<number> {
  const { Client } = await import('xrpl')
  const client = new Client(TESTNET_WSS)
  await client.connect()
  try {
    const res = await client.request({
      command: 'account_info',
      account: address,
    })
    const seq = (res.result as { account_data?: { Sequence?: number } }).account_data?.Sequence
    if (typeof seq !== 'number') throw new Error('Could not get account sequence')
    return seq
  } finally {
    client.disconnect()
  }
}

/** XRP amount to drops string */
function xrpToDrops(xrp: number | string): string {
  const n = typeof xrp === 'string' ? parseFloat(xrp) : xrp
  if (!Number.isFinite(n) || n <= 0) throw new Error('Invalid XRP amount')
  return String(Math.round(n * XRP_DROPS_PER_XRP))
}

/** Create bid escrow: lock XRP until FinishAfter, Destination = platform. */
export function useEscrow() {
  const { walletManager, addEvent, showStatus } = useWallet()

  async function createBidEscrow(
    auctionId: string,
    amountXrp: number | string,
    finishAfterRippleTime: number,
    platformDestination: string
  ): Promise<EscrowCreateResult | null> {
    if (!walletManager.value?.account) {
      showStatus('Please connect a wallet first', 'error')
      return null
    }
    const owner = walletManager.value.account.address
    const drops = xrpToDrops(amountXrp)
    const sequence = await getAccountSequence(owner)

    const toHex = (s: string) =>
      Array.from(new TextEncoder().encode(s))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('')
        .toUpperCase()
    const memo = {
      Memo: {
        MemoData: toHex(auctionId),
        MemoType: toHex('auction_id'),
      },
    }

    const tx = {
      TransactionType: 'EscrowCreate' as const,
      Account: owner,
      Destination: platformDestination,
      Amount: drops,
      FinishAfter: finishAfterRippleTime,
      Memos: [memo],
      Fee: '12',
    }

    try {
      const result = await walletManager.value.signAndSubmit(tx as any)
      const hash = result.hash ?? result.id ?? 'unknown'
      addEvent('EscrowCreate (bid)', result)
      showStatus('Bid placed! Funds held in escrow.', 'success')
      return { hash, offerSequence: sequence }
    } catch (e) {
      const msg = getErrorMessage(e)
      showStatus(`Bid failed: ${msg}`, 'error')
      addEvent('EscrowCreate failed', e)
      return null
    }
  }

  async function cancelEscrow(ownerAddress: string, offerSequence: number): Promise<boolean> {
    if (!walletManager.value?.account) {
      showStatus('Please connect a wallet first', 'error')
      return false
    }
    if (walletManager.value.account.address !== ownerAddress) {
      showStatus('Only the escrow owner can cancel', 'error')
      return false
    }
    const tx = {
      TransactionType: 'EscrowCancel' as const,
      Account: ownerAddress,
      Owner: ownerAddress,
      OfferSequence: offerSequence,
      Fee: '12',
    }
    try {
      await walletManager.value.signAndSubmit(tx as any)
      showStatus('Escrow cancelled; funds returned.', 'success')
      addEvent('EscrowCancel', { ownerAddress, offerSequence })
      return true
    } catch (e) {
      const msg = getErrorMessage(e)
      showStatus(`Cancel failed: ${msg}`, 'error')
      addEvent('EscrowCancel failed', e)
      return false
    }
  }

  async function finishEscrow(ownerAddress: string, offerSequence: number): Promise<boolean> {
    if (!walletManager.value?.account) {
      showStatus('Please connect a wallet first', 'error')
      return false
    }
    const tx = {
      TransactionType: 'EscrowFinish' as const,
      Account: walletManager.value.account.address,
      Owner: ownerAddress,
      OfferSequence: offerSequence,
      Fee: '12',
    }
    try {
      await walletManager.value.signAndSubmit(tx as any)
      showStatus('Escrow finished; funds released.', 'success')
      addEvent('EscrowFinish', { ownerAddress, offerSequence })
      return true
    } catch (e) {
      const msg = getErrorMessage(e)
      showStatus(`Finish failed: ${msg}`, 'error')
      addEvent('EscrowFinish failed', e)
      return false
    }
  }

  return {
    createBidEscrow,
    cancelEscrow,
    finishEscrow,
    xrpToDrops,
  }
}

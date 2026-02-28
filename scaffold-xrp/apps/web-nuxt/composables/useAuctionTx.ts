/**
 * Build and submit auction-related on-chain transactions.
 */
import { Client, xrpToDrops } from 'xrpl'
import {
  AUCTION_INDEX_ADDRESS,
  EVENT_AUCTION_CREATE,
  EVENT_BID,
  EVENT_SHIP_COMMIT,
  EVENT_RECEIVED_CONFIRM,
  ESCROW_RELEASE_DELAY_SEC,
  ESCROW_CANCEL_AFTER_GRACE_SEC,
  buildMemo,
  unixToRippleSeconds,
  type AuctionCreatePayload,
  type BidPayload,
  type ShipCommitPayload,
  type ReceivedConfirmPayload,
} from '~/lib/auction'

const TESTNET_WSS = 'wss://s.altnet.rippletest.net:51233'

/** Resolve the actual Sequence used by a submitted transaction hash. */
async function getSequenceFromTxHash(txHash: string): Promise<number> {
  const client = new Client(TESTNET_WSS)
  await client.connect()
  try {
    for (let attempt = 0; attempt < 20; attempt++) {
      await new Promise((r) => setTimeout(r, 1000 + attempt * 500))
      try {
        const resp = await client.request({ command: 'tx', transaction: txHash })
        const seq = (resp.result as { Sequence?: number }).Sequence
        if (seq !== undefined && seq !== null) return seq
      } catch {
        // Transaction may not be validated yet; keep retrying.
      }
    }
    throw new Error('Transaction not validated yet. Please try again shortly.')
  } finally {
    await client.disconnect()
  }
}

/** Find escrow Sequence from ledger as a fallback when BID sequence is incorrect. */
async function findEscrowSequenceFromLedger(owner: string, destination: string, amountDrops: string): Promise<number | null> {
  const client = new Client(TESTNET_WSS)
  await client.connect()
  try {
    const resp = await client.request({
      command: 'account_objects',
      account: owner,
      type: 'escrow',
    } as any)
    const objects = (resp.result as { account_objects?: unknown[] }).account_objects ?? []
    for (const obj of objects) {
      const o = obj as { Destination?: string; Amount?: string; PreviousTxnID?: string }
      if (o.Destination !== destination || String(o.Amount ?? '') !== amountDrops) continue
      const txId = o.PreviousTxnID
      if (!txId) continue
      try {
        const txResp = await client.request({ command: 'tx', transaction: txId })
        const seq = (txResp.result as { Sequence?: number }).Sequence
        if (seq) return seq
      } catch {
        // Ignore single lookup failure and keep scanning.
      }
    }
    return null
  } finally {
    await client.disconnect()
  }
}

export function useAuctionTx() {
  const { walletManager, showStatus, addEvent } = useWallet()

  const submitPaymentWithMemo = async (
    destination: string,
    amountDrops: string,
    memoType: string,
    memoData: Record<string, unknown>
  ) => {
    const wm = walletManager.value
    if (!wm?.account) {
      showStatus('Please connect a wallet first', 'error')
      throw new Error('Wallet not connected')
    }
    const memo = buildMemo(memoType, memoData)
    const tx = {
      TransactionType: 'Payment' as const,
      Account: wm.account.address,
      Destination: destination,
      Amount: amountDrops,
      Fee: '12',
      Memos: [memo],
    }
    const result = await wm.signAndSubmit(tx as any)
    addEvent('Auction Tx', result)
    return result
  }

  /** Publish auction with AUCTION_CREATE memo event. */
  const publishAuctionCreate = async (payload: AuctionCreatePayload) => {
    return submitPaymentWithMemo(AUCTION_INDEX_ADDRESS, xrpToDrops('0.000001'), EVENT_AUCTION_CREATE, payload as unknown as Record<string, unknown>)
  }

  /** Place bid: 1) EscrowCreate lock 2) BID memo to AuctionIndex. */
  const submitBid = async (params: {
    auctionId: string
    sellerAddress: string
    bidDrops: string
    endTimeUnix: number
  }) => {
    const wm = walletManager.value
    if (!wm?.account) {
      showStatus('Please connect a wallet first', 'error')
      throw new Error('Wallet not connected')
    }
    const bidder = wm.account.address
    const endRipple = unixToRippleSeconds(params.endTimeUnix)
    const finishAfterRipple = endRipple + ESCROW_RELEASE_DELAY_SEC
    const cancelAfterRipple = endRipple + ESCROW_CANCEL_AFTER_GRACE_SEC

    // 1) EscrowCreate (finish at auction end, cancel after 1 minute).
    const escrowTx = {
      TransactionType: 'EscrowCreate' as const,
      Account: bidder,
      Destination: params.sellerAddress,
      Amount: params.bidDrops,
      FinishAfter: finishAfterRipple,
      CancelAfter: cancelAfterRipple,
      Fee: '12',
    }
    const escrowResult = await wm.signAndSubmit(escrowTx as any)
    addEvent('EscrowCreate', escrowResult)

    // Resolve Sequence from confirmed tx to ensure EscrowFinish uses the right value.
    const txHash = (escrowResult as any)?.hash ?? (escrowResult as any)?.id ?? (escrowResult as any)?.result?.hash
    let escrowSeq = 0
    if (txHash && typeof txHash === 'string') {
      try {
        escrowSeq = await getSequenceFromTxHash(txHash)
      } catch {
        // If tx lookup fails, try finding escrow sequence from account objects.
        escrowSeq = (await findEscrowSequenceFromLedger(bidder, params.sellerAddress, params.bidDrops)) ?? 0
      }
    }
    if (escrowSeq === 0) {
      escrowSeq = (await findEscrowSequenceFromLedger(bidder, params.sellerAddress, params.bidDrops)) ?? 0
    }
    if (escrowSeq === 0) throw new Error('Could not resolve Escrow sequence. Please refresh and try again.')

    const bidPayload: BidPayload = {
      type: EVENT_BID,
      auction_id: params.auctionId,
      bidder,
      bid_drops: params.bidDrops,
      escrow_owner: bidder,
      escrow_seq: escrowSeq,
      ts: Math.floor(Date.now() / 1000),
    }

    // 2) BID memo (0 XRP) sent to AuctionIndex.
    await submitPaymentWithMemo(AUCTION_INDEX_ADDRESS, xrpToDrops('0.000001'), EVENT_BID, bidPayload as unknown as Record<string, unknown>)
    return { escrowResult, bidPayload }
  }

  /** EscrowFinish: release winner funds to seller (can be triggered by anyone). */
  const submitEscrowFinish = async (owner: string, seq: number) => {
    const wm = walletManager.value
    if (!wm?.account) {
      showStatus('Please connect a wallet first', 'error')
      throw new Error('Wallet not connected')
    }
    const tx = {
      TransactionType: 'EscrowFinish' as const,
      Account: wm.account.address,
      Owner: owner,
      OfferSequence: Number(seq),
      Fee: '12',
    }
    try {
      const result = await wm.signAndSubmit(tx as any)
      addEvent('EscrowFinish', result)
      return result
    } catch (e: any) {
      const msg = e?.message || e?.data?.error_message || String(e)
      if (msg.includes('tec') || msg.includes('tem')) {
        throw new Error(`Ledger rejected: ${msg}. Check: 1) auction ended 2) action is within 1 minute 3) escrow is not canceled`)
      }
      throw e
    }
  }

  /** EscrowCancel: refund non-winning bidder escrow. */
  const submitEscrowCancel = async (owner: string, seq: number) => {
    const wm = walletManager.value
    if (!wm?.account) {
      showStatus('Please connect a wallet first', 'error')
      throw new Error('Wallet not connected')
    }
    const tx = {
      TransactionType: 'EscrowCancel' as const,
      Account: wm.account.address,
      Owner: owner,
      OfferSequence: seq,
      Fee: '12',
    }
    const result = await wm.signAndSubmit(tx as any)
    addEvent('EscrowCancel', result)
    return result
  }

  /** SHIP_COMMIT: seller posts shipping commitment. */
  const submitShipCommit = async (payload: ShipCommitPayload) => {
    return submitPaymentWithMemo(AUCTION_INDEX_ADDRESS, xrpToDrops('0.000001'), EVENT_SHIP_COMMIT, payload as unknown as Record<string, unknown>)
  }

  /** RECEIVED_CONFIRM: buyer confirms receipt. */
  const submitReceivedConfirm = async (payload: ReceivedConfirmPayload) => {
    return submitPaymentWithMemo(AUCTION_INDEX_ADDRESS, xrpToDrops('0.000001'), EVENT_RECEIVED_CONFIRM, payload as unknown as Record<string, unknown>)
  }

  /** Lookup correct winner escrow sequence from ledger for retry flows. */
  const lookupEscrowSequence = async (owner: string, destination: string, amountDrops: string) => {
    return findEscrowSequenceFromLedger(owner, destination, amountDrops)
  }

  return {
    publishAuctionCreate,
    submitBid,
    submitEscrowFinish,
    submitEscrowCancel,
    lookupEscrowSequence,
    submitShipCommit,
    submitReceivedConfirm,
  }
}

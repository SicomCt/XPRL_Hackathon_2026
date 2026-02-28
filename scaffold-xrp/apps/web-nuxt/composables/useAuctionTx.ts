/**
 * 构建并提交拍卖相关链上交易
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

/** 从已提交的交易哈希获取实际使用的 Sequence */
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
        // tx 可能尚未上链，继续重试
      }
    }
    throw new Error('交易尚未确认，请稍后重试')
  } finally {
    await client.disconnect()
  }
}

/** 从链上查找 Escrow 的 Sequence（当 BID 中存的 sequence 有误时备用） */
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
        // 忽略单条查询失败
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
      showStatus('请先连接钱包', 'error')
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

  /** 发布拍品 AUCTION_CREATE */
  const publishAuctionCreate = async (payload: AuctionCreatePayload) => {
    return submitPaymentWithMemo(AUCTION_INDEX_ADDRESS, xrpToDrops('0.000001'), EVENT_AUCTION_CREATE, payload as unknown as Record<string, unknown>)
  }

  /** 出价：1. EscrowCreate 锁款  2. BID Memo 到 AuctionIndex */
  const submitBid = async (params: {
    auctionId: string
    sellerAddress: string
    bidDrops: string
    endTimeUnix: number
  }) => {
    const wm = walletManager.value
    if (!wm?.account) {
      showStatus('请先连接钱包', 'error')
      throw new Error('Wallet not connected')
    }
    const bidder = wm.account.address
    const endRipple = unixToRippleSeconds(params.endTimeUnix)
    const finishAfterRipple = endRipple + ESCROW_RELEASE_DELAY_SEC
    const cancelAfterRipple = endRipple + ESCROW_CANCEL_AFTER_GRACE_SEC

    // 1. EscrowCreate（拍卖结束即可 Finish，1 分钟后可 Cancel）
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

    // 从实际交易获取 Sequence，确保 EscrowFinish 使用正确值
    const txHash = (escrowResult as any)?.hash ?? (escrowResult as any)?.id ?? (escrowResult as any)?.result?.hash
    let escrowSeq = 0
    if (txHash && typeof txHash === 'string') {
      try {
        escrowSeq = await getSequenceFromTxHash(txHash)
      } catch {
        // 若 tx 查询失败，尝试从链上 escrow 列表查找
        escrowSeq = (await findEscrowSequenceFromLedger(bidder, params.sellerAddress, params.bidDrops)) ?? 0
      }
    }
    if (escrowSeq === 0) {
      escrowSeq = (await findEscrowSequenceFromLedger(bidder, params.sellerAddress, params.bidDrops)) ?? 0
    }
    if (escrowSeq === 0) throw new Error('无法获取 Escrow 序号，请稍后刷新页面重试')

    const bidPayload: BidPayload = {
      type: EVENT_BID,
      auction_id: params.auctionId,
      bidder,
      bid_drops: params.bidDrops,
      escrow_owner: bidder,
      escrow_seq: escrowSeq,
      ts: Math.floor(Date.now() / 1000),
    }

    // 2. BID Memo（0 XRP 到 AuctionIndex）
    await submitPaymentWithMemo(AUCTION_INDEX_ADDRESS, xrpToDrops('0.000001'), EVENT_BID, bidPayload as unknown as Record<string, unknown>)
    return { escrowResult, bidPayload }
  }

  /** EscrowFinish：赢家放款给卖家（任何人可触发） */
  const submitEscrowFinish = async (owner: string, seq: number) => {
    const wm = walletManager.value
    if (!wm?.account) {
      showStatus('请先连接钱包', 'error')
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
        throw new Error(`链上拒绝: ${msg}。请确认：1) 拍卖已结束 2) 在 1 分钟内操作 3) Escrow 未被取消`)
      }
      throw e
    }
  }

  /** EscrowCancel：输家退款 */
  const submitEscrowCancel = async (owner: string, seq: number) => {
    const wm = walletManager.value
    if (!wm?.account) {
      showStatus('请先连接钱包', 'error')
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

  /** SHIP_COMMIT：卖家承诺发货 */
  const submitShipCommit = async (payload: ShipCommitPayload) => {
    return submitPaymentWithMemo(AUCTION_INDEX_ADDRESS, xrpToDrops('0.000001'), EVENT_SHIP_COMMIT, payload as unknown as Record<string, unknown>)
  }

  /** RECEIVED_CONFIRM：买家确认收货 */
  const submitReceivedConfirm = async (payload: ReceivedConfirmPayload) => {
    return submitPaymentWithMemo(AUCTION_INDEX_ADDRESS, xrpToDrops('0.000001'), EVENT_RECEIVED_CONFIRM, payload as unknown as Record<string, unknown>)
  }

  /** 从链上查找赢家 Escrow 的正确 Sequence（EscrowFinish 失败时可重试） */
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

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
  ESCROW_CANCEL_AFTER_GRACE_SEC,
  buildMemo,
  unixToRippleSeconds,
  type AuctionCreatePayload,
  type BidPayload,
  type ShipCommitPayload,
  type ReceivedConfirmPayload,
} from '~/lib/auction'

const TESTNET_WSS = 'wss://s.altnet.rippletest.net:51233'

async function getAccountSequence(address: string): Promise<number> {
  const client = new Client(TESTNET_WSS)
  await client.connect()
  try {
    const resp = await client.request({ command: 'account_info', account: address })
    return (resp.result as { account_data?: { Sequence?: number } }).account_data?.Sequence ?? 0
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
    const cancelAfterRipple = endRipple + ESCROW_CANCEL_AFTER_GRACE_SEC

    // 发 EscrowCreate 前获取当前 sequence，用于 BID memo（Escrow 由 Owner+OfferSequence 标识）
    const escrowSeq = await getAccountSequence(bidder)

    // 1. EscrowCreate
    const escrowTx = {
      TransactionType: 'EscrowCreate' as const,
      Account: bidder,
      Destination: params.sellerAddress,
      Amount: params.bidDrops,
      FinishAfter: endRipple,
      CancelAfter: cancelAfterRipple,
      Fee: '12',
    }
    const escrowResult = await wm.signAndSubmit(escrowTx as any)
    addEvent('EscrowCreate', escrowResult)
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

  /** EscrowFinish：赢家放款给卖家 */
  const submitEscrowFinish = async (owner: string, seq: number) => {
    const wm = walletManager.value
    if (!wm?.account) {
      showStatus('请先连接钱包', 'error')
      throw new Error('Wallet not connected')
    }
    const tx = {
      TransactionType: 'EscrowFinish' as const,
      Account: wm.account.address, // 任何人可以触发，但通常由卖家或结算器
      Owner: owner,
      OfferSequence: seq,
      Fee: '12',
    }
    const result = await wm.signAndSubmit(tx as any)
    addEvent('EscrowFinish', result)
    return result
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

  return {
    publishAuctionCreate,
    submitBid,
    submitEscrowFinish,
    submitEscrowCancel,
    submitShipCommit,
    submitReceivedConfirm,
  }
}

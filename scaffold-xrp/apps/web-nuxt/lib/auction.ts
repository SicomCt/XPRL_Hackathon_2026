/**
 * 链上拍卖 - 常量、类型、工具
 * 设计：AuctionIndex 锚点 + Memo 事件流 + Escrow 锁款
 */

/** Ripple Epoch：2000-01-01 00:00:00 UTC，比 Unix Epoch 晚 946684800 秒 */
export const RIPPLE_EPOCH_OFFSET = 946684800

/** 拍卖索引锚点地址（AuctionIndex），接收 0 XRP + Memo 作为事件流 */
export const AUCTION_INDEX_ADDRESS = 'rPT1Sjq2YGrBMTttX4GZHjKu9dyfzbpAYe'

/** 1 XRP = 1,000,000 drops */
export const XRP_TO_DROPS = 1_000_000

/** Escrow 释放延迟（秒）：0 = 拍卖结束即可 EscrowFinish */
export const ESCROW_RELEASE_DELAY_SEC = 0
/** CancelAfter：1 分钟后，输家可申请退款。EscrowFinish 窗口为 1 分钟 */
export const ESCROW_CANCEL_AFTER_GRACE_SEC = 60

// --- 事件类型 ---
export const EVENT_AUCTION_CREATE = 'AUCTION_CREATE'
export const EVENT_BID = 'BID'
export const EVENT_SHIP_COMMIT = 'SHIP_COMMIT'
export const EVENT_RECEIVED_CONFIRM = 'RECEIVED_CONFIRM'

// --- 类型定义 ---
export interface AuctionCreatePayload {
  type: typeof EVENT_AUCTION_CREATE
  auction_id: string
  seller: string
  title: string
  desc_hash: string // sha256 或 IPFS CID，用于详情防篡改
  start_time: number // Unix 秒
  end_time: number // Unix 秒
  currency: string
  min_increment_drops: string
  reserve_drops: string
  shipping_policy_hash?: string
}

export interface BidPayload {
  type: typeof EVENT_BID
  auction_id: string
  bidder: string
  bid_drops: string
  escrow_owner: string
  escrow_seq: number
  ts: number
}

export interface ShipCommitPayload {
  type: typeof EVENT_SHIP_COMMIT
  auction_id: string
  seller: string
  winner: string
  tracking_hash?: string // 物流单号 hash 或明文
  ts: number
}

export interface ReceivedConfirmPayload {
  type: typeof EVENT_RECEIVED_CONFIRM
  auction_id: string
  buyer: string
  ts: number
}

export type AuctionEventPayload =
  | AuctionCreatePayload
  | BidPayload
  | ShipCommitPayload
  | ReceivedConfirmPayload

export interface ParsedAuctionEvent {
  txHash: string
  ledgerIndex?: number
  payload: AuctionEventPayload
  rawTx?: unknown
}

export interface AuctionWithBids {
  auction: AuctionCreatePayload
  txHash: string
  bids: Array<{ payload: BidPayload; txHash: string }>
  shipCommit?: { payload: ShipCommitPayload; txHash: string }
  receivedConfirm?: { payload: ReceivedConfirmPayload; txHash: string }
}

// --- 工具函数 ---

/** 字符串转 hex（XRPL Memo 格式） */
export function toHex(text: string): string {
  return Array.from(new TextEncoder().encode(text))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase()
}

/** hex 转字符串 */
export function fromHex(hex: string): string {
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16)
  }
  return new TextDecoder().decode(bytes)
}

/** Unix 秒 → Ripple Epoch 秒 */
export function unixToRippleSeconds(unixSeconds: number): number {
  return unixSeconds - RIPPLE_EPOCH_OFFSET
}

/** Ripple Epoch 秒 → Unix 秒 */
export function rippleToUnixSeconds(rippleSeconds: number): number {
  return rippleSeconds + RIPPLE_EPOCH_OFFSET
}

/** 构建 Memo 对象 */
export function buildMemo(type: string, data: Record<string, unknown>): { Memo: { MemoType: string; MemoData: string } } {
  return {
    Memo: {
      MemoType: toHex(type),
      MemoData: toHex(JSON.stringify(data)),
    },
  }
}

/** 解析交易中的 Memo 为事件 */
export function parseMemosFromTx(tx: { Memos?: Array<{ Memo?: { MemoType?: string; MemoData?: string } }> }): AuctionEventPayload | null {
  const memos = tx.Memos
  if (!memos?.length) return null
  const first = memos[0]?.Memo
  if (!first?.MemoData) return null
  try {
    const json = fromHex(first.MemoData)
    const parsed = JSON.parse(json) as AuctionEventPayload
    if (parsed.type && typeof parsed.type === 'string') return parsed
    return null
  } catch {
    return null
  }
}

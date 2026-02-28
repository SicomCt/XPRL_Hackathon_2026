/**
 * On-chain auction constants, types, and helpers.
 * Design: AuctionIndex anchor + memo event stream + escrow locking.
 */

/** Ripple Epoch starts at 2000-01-01 00:00:00 UTC (Unix offset: 946684800). */
export const RIPPLE_EPOCH_OFFSET = 946684800

/** Auction index anchor address receiving 0 XRP + memo events. */
export const AUCTION_INDEX_ADDRESS = 'rPT1Sjq2YGrBMTttX4GZHjKu9dyfzbpAYe'

/** 1 XRP = 1,000,000 drops */
export const XRP_TO_DROPS = 1_000_000

/** Escrow release delay in seconds: 0 means EscrowFinish right after auction end. */
export const ESCROW_RELEASE_DELAY_SEC = 0
/** CancelAfter grace period: non-winners can refund after 1 minute. */
export const ESCROW_CANCEL_AFTER_GRACE_SEC = 60

// --- Event types ---
export const EVENT_AUCTION_CREATE = 'AUCTION_CREATE'
export const EVENT_BID = 'BID'
export const EVENT_SHIP_COMMIT = 'SHIP_COMMIT'
export const EVENT_RECEIVED_CONFIRM = 'RECEIVED_CONFIRM'

// --- Type definitions ---
export interface AuctionCreatePayload {
  type: typeof EVENT_AUCTION_CREATE
  auction_id: string
  seller: string
  title: string
  desc_hash: string // sha256 hash or IPFS CID for tamper-resistant metadata
  start_time: number // Unix seconds
  end_time: number // Unix seconds
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
  tracking_hash?: string // shipping tracking hash or raw value
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

// --- Utility helpers ---

/** Convert string to hex for XRPL memo format. */
export function toHex(text: string): string {
  return Array.from(new TextEncoder().encode(text))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase()
}

/** Convert hex back to string. */
export function fromHex(hex: string): string {
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16)
  }
  return new TextDecoder().decode(bytes)
}

/** Convert Unix seconds to Ripple Epoch seconds. */
export function unixToRippleSeconds(unixSeconds: number): number {
  return unixSeconds - RIPPLE_EPOCH_OFFSET
}

/** Convert Ripple Epoch seconds to Unix seconds. */
export function rippleToUnixSeconds(rippleSeconds: number): number {
  return rippleSeconds + RIPPLE_EPOCH_OFFSET
}

/** Build XRPL Memo object. */
export function buildMemo(type: string, data: Record<string, unknown>): { Memo: { MemoType: string; MemoData: string } } {
  return {
    Memo: {
      MemoType: toHex(type),
      MemoData: toHex(JSON.stringify(data)),
    },
  }
}

/** Parse transaction memos into an auction event payload. */
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

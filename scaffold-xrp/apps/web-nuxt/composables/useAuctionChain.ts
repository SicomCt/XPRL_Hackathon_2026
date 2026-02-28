/**
 * 从链上扫描 AuctionIndex 地址的交易，解析拍卖事件流
 */
import { Client } from 'xrpl'
import {
  AUCTION_INDEX_ADDRESS,
  EVENT_AUCTION_CREATE,
  EVENT_BID,
  EVENT_SHIP_COMMIT,
  EVENT_RECEIVED_CONFIRM,
  type AuctionCreatePayload,
  type BidPayload,
  type ShipCommitPayload,
  type ReceivedConfirmPayload,
  type AuctionWithBids,
  parseMemosFromTx,
} from '~/lib/auction'

const TESTNET_WSS = 'wss://s.altnet.rippletest.net:51233'

export function useAuctionChain() {
  const fetchAccountTransactions = async (limit = 200): Promise<Array<{
    tx: Record<string, unknown>
    hash: string
    ledger_index?: number
  }>> => {
    const client = new Client(TESTNET_WSS)
    await client.connect()
    try {
      const resp = await client.request({
        command: 'account_tx',
        account: AUCTION_INDEX_ADDRESS,
        limit,
      })
      const txs = (resp.result as { transactions?: Array<Record<string, unknown>> }).transactions || []
      return txs.map((t: Record<string, unknown>) => {
        const txObj = (t.tx ?? t.tx_json ?? t) as Record<string, unknown>
        return {
          tx: txObj,
          hash: String(t.hash ?? ''),
          ledger_index: typeof t.ledger_index === 'number' ? t.ledger_index : undefined,
        }
      })
    } finally {
      await client.disconnect()
    }
  }

  const parseEvents = (txs: Array<{ tx: Record<string, unknown>; hash: string; ledger_index?: number }>) => {
    const events: Array<{ payload: AuctionCreatePayload | BidPayload | ShipCommitPayload | ReceivedConfirmPayload; txHash: string; ledgerIndex?: number }> = []
    for (const { tx, hash, ledger_index } of txs) {
      const payload = parseMemosFromTx(tx as { Memos?: Array<{ Memo?: { MemoType?: string; MemoData?: string } }> })
      if (!payload) continue
      if (
        payload.type === EVENT_AUCTION_CREATE ||
        payload.type === EVENT_BID ||
        payload.type === EVENT_SHIP_COMMIT ||
        payload.type === EVENT_RECEIVED_CONFIRM
      ) {
        events.push({ payload, txHash: hash, ledgerIndex: ledger_index })
      }
    }
    return events
  }

  const buildAuctionMap = (
    events: Array<{ payload: AuctionCreatePayload | BidPayload | ShipCommitPayload | ReceivedConfirmPayload; txHash: string }>
  ): Map<string, AuctionWithBids> => {
    const map = new Map<string, AuctionWithBids>()
    const ordered = [...events].reverse()
    for (const { payload, txHash } of ordered) {
      if (payload.type === EVENT_AUCTION_CREATE) {
        const p = payload as AuctionCreatePayload
        let a = map.get(p.auction_id)
        if (!a) {
          a = { auction: p, txHash, bids: [] }
          map.set(p.auction_id, a)
        } else {
          a.auction = p
          a.txHash = txHash
        }
      } else if (payload.type === EVENT_BID) {
        const p = payload as BidPayload
        let a = map.get(p.auction_id)
        if (!a) {
          a = { auction: null as unknown as AuctionCreatePayload, txHash: '', bids: [] }
          map.set(p.auction_id, a)
        }
        a.bids.push({ payload: p, txHash })
      } else if (payload.type === EVENT_SHIP_COMMIT) {
        const p = payload as ShipCommitPayload
        const a = map.get(p.auction_id)
        if (a) a.shipCommit = { payload: p, txHash }
      } else if (payload.type === EVENT_RECEIVED_CONFIRM) {
        const p = payload as ReceivedConfirmPayload
        const a = map.get(p.auction_id)
        if (a) a.receivedConfirm = { payload: p, txHash }
      }
    }
    return map
  }

  const fetchAuctions = async (): Promise<AuctionWithBids[]> => {
    const txs = await fetchAccountTransactions()
    const events = parseEvents(txs)
    const map = buildAuctionMap(events)
    const list: AuctionWithBids[] = []
    for (const [, v] of map) {
      if (v.auction && typeof v.auction.auction_id === 'string') {
        list.push(v)
      }
    }
    return list.sort((a, b) => b.auction.end_time - a.auction.end_time)
  }

  return {
    fetchAccountTransactions,
    parseEvents,
    buildAuctionMap,
    fetchAuctions,
  }
}

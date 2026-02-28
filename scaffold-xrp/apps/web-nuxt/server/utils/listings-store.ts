/**
 * In-memory listings store (MVP). Replace with DB (e.g. D1, Turso) for production.
 */

const RIPPLE_EPOCH = 946684800

export interface Listing {
  id: string
  title: string
  description: string
  imageUrl?: string
  sellerAddress: string
  /** Tx hash of on-chain attestation (Payment with Memo or similar) */
  attestationTxHash?: string
  createdAt: string
  /** Auction end time, ISO string */
  endTime: string
  /** Minimum bid in XRP (number) */
  minBidXrp?: number
  status: 'active' | 'ended' | 'cancelled'
}

const listings: Map<string, Listing> = new Map()

function nextId(): string {
  return 'lst_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 9)
}

export function listListings(): Listing[] {
  return Array.from(listings.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )
}

export function getListing(id: string): Listing | undefined {
  return listings.get(id)
}

export function createListing(input: Omit<Listing, 'id' | 'createdAt' | 'status'>): Listing {
  const listing: Listing = {
    ...input,
    id: nextId(),
    createdAt: new Date().toISOString(),
    status: 'active',
  }
  listings.set(listing.id, listing)
  return listing
}

export function updateListing(id: string, updates: Partial<Pick<Listing, 'attestationTxHash' | 'status'>>): Listing | undefined {
  const listing = listings.get(id)
  if (!listing) return undefined
  Object.assign(listing, updates)
  return listing
}

/** Convert JS Date to XRPL FinishAfter (seconds since Ripple epoch) */
export function toRippleTime(date: Date): number {
  return Math.floor(date.getTime() / 1000) - RIPPLE_EPOCH
}

/** Bid = escrow created for an auction (so "my bids" can list and cancel) */
export interface BidRecord {
  auctionId: string
  owner: string
  offerSequence: number
  amountXrp: string
  txHash: string
  createdAt: string
}

const bids: BidRecord[] = []

export function addBid(bid: BidRecord): void {
  bids.push(bid)
}

export function getBidsByOwner(owner: string): BidRecord[] {
  return bids.filter((b) => b.owner === owner)
}

export function getBidsByAuction(auctionId: string): BidRecord[] {
  return bids.filter((b) => b.auctionId === auctionId)
}

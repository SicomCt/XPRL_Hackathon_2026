import { getBidsByOwner, getBidsByAuction } from '~/server/utils/listings-store'

export default defineEventHandler((event) => {
  const query = getQuery(event)
  const owner = query.owner as string | undefined
  const auctionId = query.auctionId as string | undefined
  if (auctionId?.trim()) return getBidsByAuction(auctionId.trim())
  if (owner?.trim()) return getBidsByOwner(owner.trim())
  return []
})

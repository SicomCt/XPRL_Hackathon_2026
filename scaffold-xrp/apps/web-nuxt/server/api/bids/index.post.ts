import { addBid } from '~/server/utils/listings-store'

export default defineEventHandler(async (event) => {
  const body = await readBody(event) as Record<string, unknown>
  const auctionId = typeof body?.auctionId === 'string' ? body.auctionId.trim() : ''
  const owner = typeof body?.owner === 'string' ? body.owner.trim() : ''
  const offerSequence = typeof body?.offerSequence === 'number' ? body.offerSequence : Number(body?.offerSequence)
  const amountXrp = typeof body?.amountXrp === 'string' ? body.amountXrp : String(body?.amountXrp ?? '')
  const txHash = typeof body?.txHash === 'string' ? body.txHash.trim() : ''
  if (!auctionId || !owner || !Number.isInteger(offerSequence) || !amountXrp || !txHash) {
    throw createError({ statusCode: 400, message: 'auctionId, owner, offerSequence, amountXrp, txHash required' })
  }
  addBid({
    auctionId,
    owner,
    offerSequence,
    amountXrp,
    txHash,
    createdAt: new Date().toISOString(),
  })
  return { ok: true }
})

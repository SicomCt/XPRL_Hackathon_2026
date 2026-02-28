import { createListing } from '~/server/utils/listings-store'

export default defineEventHandler(async (event) => {
  const body = await readBody(event) as Record<string, unknown>
  if (!body || typeof body.title !== 'string' || !body.title.trim()) {
    throw createError({ statusCode: 400, message: 'title is required' })
  }
  if (typeof body.description !== 'string' || !body.description.trim()) {
    throw createError({ statusCode: 400, message: 'description is required' })
  }
  if (typeof body.sellerAddress !== 'string' || !body.sellerAddress.trim()) {
    throw createError({ statusCode: 400, message: 'sellerAddress is required' })
  }
  if (typeof body.endTime !== 'string' || !body.endTime) {
    throw createError({ statusCode: 400, message: 'endTime is required (ISO string)' })
  }
  const endTime = new Date(body.endTime)
  if (Number.isNaN(endTime.getTime())) {
    throw createError({ statusCode: 400, message: 'endTime must be valid ISO date' })
  }
  const minBidXrp = body.minBidXrp != null ? Number(body.minBidXrp) : undefined
  if (minBidXrp != null && (typeof minBidXrp !== 'number' || minBidXrp <= 0)) {
    throw createError({ statusCode: 400, message: 'minBidXrp must be a positive number' })
  }
  const imageUrl = typeof body.imageUrl === 'string' && body.imageUrl ? body.imageUrl : undefined
  return createListing({
    title: body.title.trim(),
    description: body.description.trim(),
    sellerAddress: body.sellerAddress.trim(),
    endTime: body.endTime,
    imageUrl,
    minBidXrp,
  })
})

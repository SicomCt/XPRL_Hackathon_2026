import { updateListing, getListing } from '~/server/utils/listings-store'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'Missing id' })
  const listing = getListing(id)
  if (!listing) throw createError({ statusCode: 404, message: 'Listing not found' })
  const body = await readBody(event) as Record<string, unknown>
  const attestationTxHash = typeof body?.attestationTxHash === 'string' && body.attestationTxHash.trim()
    ? body.attestationTxHash.trim()
    : undefined
  const status = body?.status === 'ended' || body?.status === 'cancelled' ? body.status : undefined
  const updated = updateListing(id, { ...(attestationTxHash && { attestationTxHash }), ...(status && { status }) })
  return updated
})

import { getListing } from '~/server/utils/listings-store'

export default defineEventHandler((event) => {
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, message: 'Missing id' })
  }
  const listing = getListing(id)
  if (!listing) {
    throw createError({ statusCode: 404, message: 'Listing not found' })
  }
  return listing
})

import { listListings } from '~/server/utils/listings-store'

export default defineEventHandler(() => {
  return listListings()
})

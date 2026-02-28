<template>
  <div class="max-w-4xl mx-auto p-6">
    <h1 class="text-2xl font-bold mb-6">Auction Marketplace</h1>
    <p class="text-gray-600 mb-4">
      Auctions are indexed from XRPL memo events at {{ AUCTION_INDEX_ADDRESS }}
    </p>

    <div v-if="loading" class="text-center py-12">Loading auctions...</div>
    <div v-else-if="error" class="text-red-600 py-4">{{ error }}</div>
    <div v-else class="space-y-4">
      <div
        v-for="item in auctions"
        :key="item.auction.auction_id"
        class="card hover:shadow-lg transition-shadow cursor-pointer"
        @click="goToAuction(item.auction.auction_id)"
      >
        <div class="flex justify-between items-start">
          <div>
            <h2 class="font-bold text-lg">{{ item.auction.title }}</h2>
            <p class="text-sm text-gray-500">ID: {{ item.auction.auction_id }}</p>
            <p class="text-sm">Seller: {{ shorten(item.auction.seller) }}</p>
            <p class="text-sm">
              Reserve: {{ dropsToXrp(item.auction.reserve_drops) }} XRP · {{ item.bids.length }} bids
            </p>
            <p class="text-xs text-gray-400 mt-1">
              Ends: {{ formatTime(item.auction.end_time) }}
              <span
                :class="item.auction.end_time * 1000 < Date.now() ? 'text-orange-600' : 'text-green-600'"
              >
                {{ item.auction.end_time * 1000 < Date.now() ? '(Ended)' : '(Live)' }}
              </span>
            </p>
          </div>
          <div class="text-right">
            <span
              v-if="getHighestBid(item)"
              class="text-lg font-bold text-accent"
            >
              {{ dropsToXrp(getHighestBid(item)!.payload.bid_drops) }} XRP
            </span>
            <span v-else class="text-gray-400">No bids yet</span>
          </div>
        </div>
      </div>
      <div v-if="!auctions.length" class="text-center py-12 text-gray-500">
        No auctions yet. <NuxtLink to="/create" class="text-accent underline">Create your first auction</NuxtLink>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { AUCTION_INDEX_ADDRESS, XRP_TO_DROPS } from '~/lib/auction'
import type { AuctionWithBids } from '~/lib/auction'

useHead({ title: 'Auction Pool - On-Chain Auction' })

const { fetchAuctions } = useAuctionChain()
const auctions = ref<AuctionWithBids[]>([])
const loading = ref(true)
const error = ref('')

function dropsToXrp(drops: string): string {
  return (Number(drops) / XRP_TO_DROPS).toFixed(2)
}

function shorten(addr: string): string {
  if (!addr || addr.length < 12) return addr
  return `${addr.slice(0, 8)}...${addr.slice(-6)}`
}

function formatTime(ts: number): string {
  return new Date(ts * 1000).toLocaleString()
}

function getHighestBid(item: AuctionWithBids): { payload: { bid_drops: string }; txHash: string } | null {
  if (!item.bids.length) return null
  return item.bids.reduce((a, b) =>
    Number(b.payload.bid_drops) > Number(a.payload.bid_drops) ? b : a
  )
}

function goToAuction(id: string) {
  return navigateTo(`/auction/${id}`)
}

onMounted(async () => {
  try {
    auctions.value = await fetchAuctions()
  } catch (e: any) {
    error.value = e?.message || 'Load failed'
  } finally {
    loading.value = false
  }
})
</script>

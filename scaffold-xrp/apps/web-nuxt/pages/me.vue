<template>
  <div class="max-w-3xl mx-auto p-6 space-y-6">
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-bold">My Bids</h1>
    </div>

    <div class="border rounded p-4">
      <div class="text-sm text-gray-600 mb-2">Mock escrows</div>
      <ul class="space-y-2 text-sm">
        <li v-for="e in escrows" :key="e.hash" class="flex items-center justify-between border rounded p-3">
          <div>
            <div><b>Auction:</b> {{ e.auctionId }}</div>
            <div><b>Title:</b> {{ e.title }}</div>
            <div><b>Amount:</b> {{ e.amount }} XRP</div>
            <div><b>Start:</b> {{ e.startTime }}</div>
            <div><b>End:</b> {{ e.endTime }}</div>
            <div><b>Meta CID:</b> {{ e.metaCid || '-' }}</div>
            <div><b>Anchor Tx:</b> {{ e.anchorTxHash || '-' }}</div>
            <div class="text-xs text-gray-500">tx: {{ e.hash }}</div>
          </div>
          <button class="border rounded px-3 py-1" @click="mockCancel(e.hash)">
            Cancel (mock)
          </button>
        </li>
      </ul>
    </div>

    <div class="text-xs text-gray-600">
      下一步：这里会调用 EscrowCancel 退款（落标者解锁资金）
    </div>
  </div>
</template>

<script setup lang="ts">
interface MockEscrow {
  auctionId: string
  title: string
  amount: string
  startTime: string
  endTime: string
  metaCid?: string
  anchorTxHash?: string
  hash: string
}

interface MockAuction {
  id: string
  title: string
  startPriceXrp: string
  startTime: string
  endTime: string
  metaCid?: string
  anchorTxHash?: string
}

const MOCK_AUCTIONS_KEY = 'mock_auctions_v1'

function fmt(iso: string): string {
  if (!iso) return '-'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleString()
}

function toMockEscrows(auctions: MockAuction[]): MockEscrow[] {
  return auctions.map((auction, idx) => ({
    auctionId: auction.id,
    title: auction.title,
    amount: (Number(auction.startPriceXrp || '0') + 1).toString(),
    startTime: fmt(auction.startTime),
    endTime: fmt(auction.endTime),
    metaCid: auction.metaCid,
    anchorTxHash: auction.anchorTxHash,
    hash: `MOCK_TX_${idx + 1}_${auction.id}`,
  }))
}

const escrows = ref<MockEscrow[]>([])

function loadEscrows() {
  if (!process.client) return
  const raw = localStorage.getItem(MOCK_AUCTIONS_KEY)
  const auctions = raw ? (JSON.parse(raw) as MockAuction[]) : []
  escrows.value = toMockEscrows(auctions)
}

onMounted(() => {
  loadEscrows()
  window.addEventListener('storage', loadEscrows)
})

onUnmounted(() => {
  window.removeEventListener('storage', loadEscrows)
})

function mockCancel(hash: string) {
  alert(`Me page OK ✅ 下一步对 escrow ${hash} 发 EscrowCancel`)
}
</script>
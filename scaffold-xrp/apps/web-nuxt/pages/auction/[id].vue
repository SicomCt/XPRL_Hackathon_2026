<template>
  <div class="max-w-3xl mx-auto p-6 space-y-6">
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-bold">Auction: {{ id }}</h1>
    </div>

    <div class="border rounded p-4 space-y-2">
      <div class="text-sm text-gray-600">Mock data now</div>
      <div><b>Highest Bid:</b> {{ highestBid }} XRP</div>
      <div><b>End:</b> {{ endTime }}</div>
    </div>

    <div class="border rounded p-4 space-y-3">
      <h2 class="font-semibold">Place a bid (EscrowCreate later)</h2>
      <div>
        <label class="text-sm">Bid Amount (XRP)</label>
        <input v-model="bidXrp" class="mt-1 w-full border rounded p-2" />
      </div>
      <button class="border rounded px-4 py-2" @click="mockBid">
        Bid (mock)
      </button>
      <div class="text-xs text-gray-600">
        下一步：这里会创建 EscrowCreate（Destination=平台地址，FinishAfter=endTime，Memo=auction_id）
      </div>
    </div>

    <div class="border rounded p-4">
      <h2 class="font-semibold mb-2">Bid History (from indexer)</h2>
      <ul class="text-sm list-disc ml-5">
        <li v-for="(b, i) in bids" :key="i">{{ b }}</li>
      </ul>
    </div>
  </div>
</template>

<script setup lang="ts">
const route = useRoute()
const id = computed(() => (route.params.id as string) ?? '')

const highestBid = ref("10")
const endTime = ref("2026-03-01 18:00")
const bidXrp = ref("11")
const bids = ref<string[]>(["rAAA... bid 10 XRP", "rBBB... bid 11 XRP (pending)"])

function mockBid() {
  alert(`Bid page OK ✅ 下一步把 ${bidXrp.value} XRP 变成 EscrowCreate 上链`)
}
</script>
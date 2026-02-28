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
            <div><b>Amount:</b> {{ e.amount }} XRP</div>
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
// 接链上数据时改为 ref/reactive
const escrows = ref([
  { auctionId: 'auc_123', amount: '11', hash: 'ABC...123' },
  { auctionId: 'auc_456', amount: '20', hash: 'DEF...456' },
])

function mockCancel(hash: string) {
  alert(`Me page OK ✅ 下一步对 escrow ${hash} 发 EscrowCancel`)
}
</script>
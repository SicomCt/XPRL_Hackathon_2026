<template>
  <div class="max-w-3xl mx-auto p-6 space-y-6">
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-bold">我的出價（Smart Escrow）</h1>
      <NuxtLink to="/market" class="text-sm text-gray-500 hover:underline">競標市場</NuxtLink>
    </div>

    <div v-if="!isConnected" class="border rounded-lg p-4 bg-amber-50 text-amber-800">
      請先連接錢包，才能看到您的 Escrow 出價並執行取消/完成。
    </div>

    <div v-else class="border rounded-lg p-4">
      <p class="text-sm text-gray-600 mb-3">您已用 EscrowCreate 鎖倉的出價（落標可取消退款，得標由賣家 EscrowFinish 釋放）</p>
      <ul class="space-y-3">
        <li
          v-for="b in myBids"
          :key="b.txHash + b.offerSequence"
          class="flex flex-wrap items-center justify-between gap-2 border rounded p-3 bg-white"
        >
          <div class="text-sm">
            <div><b>競標：</b><NuxtLink :to="`/auction/${b.auctionId}`" class="text-accent hover:underline">{{ b.auctionId }}</NuxtLink></div>
            <div><b>金額：</b>{{ b.amountXrp }} XRP</div>
            <div class="text-xs text-gray-500 truncate max-w-xs">tx: {{ b.txHash }}</div>
          </div>
          <div class="flex gap-2">
            <button
              class="border rounded px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200"
              @click="cancelBid(b)"
            >
              取消（EscrowCancel 退款）
            </button>
          </div>
        </li>
      </ul>
      <p v-if="myBids.length === 0" class="text-gray-400 text-sm">尚無 Escrow 出價記錄</p>
    </div>
  </div>
</template>

<script setup lang="ts">
const { isConnected, accountInfo } = useWallet()
const { cancelEscrow } = useEscrow()

const myBids = ref<{
  auctionId: string
  owner: string
  offerSequence: number
  amountXrp: string
  txHash: string
}[]>([])

async function loadMyBids() {
  const owner = accountInfo.value?.address
  if (!owner) {
    myBids.value = []
    return
  }
  try {
    const data = await $fetch<typeof myBids.value>('/api/bids', { query: { owner } })
    myBids.value = data ?? []
  } catch {
    myBids.value = []
  }
}

async function cancelBid(b: { owner: string; offerSequence: number }) {
  const ok = await cancelEscrow(b.owner, b.offerSequence)
  if (ok) await loadMyBids()
}

onMounted(loadMyBids)
watch(accountInfo, loadMyBids, { deep: true })
</script>

<template>
  <div class="max-w-4xl mx-auto p-6 space-y-6">
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-bold">競標市場</h1>
      <NuxtLink to="/create" class="text-sm px-4 py-2 bg-accent text-white rounded hover:bg-accent/90">上架商品</NuxtLink>
    </div>

    <p class="text-gray-600">商品上架後可「上鏈驗證」確保憑證；買家出價使用 Smart Escrow 鎖倉。</p>

    <div v-if="loading" class="text-gray-500">載入中…</div>
    <ul v-else class="grid gap-4 sm:grid-cols-2">
      <li
        v-for="item in listings"
        :key="item.id"
        class="border rounded-lg p-4 bg-white shadow-sm hover:shadow-md transition-shadow"
      >
        <NuxtLink :to="`/auction/${item.id}`" class="block">
          <div class="flex items-center gap-2 mb-2">
            <span
              :class="[
                'text-xs px-2 py-0.5 rounded',
                item.attestationTxHash ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'
              ]"
            >
              {{ item.attestationTxHash ? '已上鍊' : '未上鍊' }}
            </span>
            <span v-if="item.status !== 'active'" class="text-xs text-gray-500">{{ item.status === 'ended' ? '已結束' : '已取消' }}</span>
          </div>
          <h2 class="font-semibold text-lg">{{ item.title }}</h2>
          <p class="text-sm text-gray-600 line-clamp-2">{{ item.description }}</p>
          <p class="text-xs text-gray-400 mt-2">結標 {{ item.endTime }}</p>
        </NuxtLink>
      </li>
    </ul>
    <p v-if="!loading && listings.length === 0" class="text-gray-400">尚無商品，請先上架。</p>
  </div>
</template>

<script setup lang="ts">
const listings = ref<{
  id: string
  title: string
  description: string
  endTime: string
  status: string
  attestationTxHash?: string
}[]>([])
const loading = ref(true)

async function load() {
  loading.value = true
  try {
    listings.value = await $fetch('/api/listings')
  } catch {
    listings.value = []
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

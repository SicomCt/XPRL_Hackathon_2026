<template>
  <div class="max-w-3xl mx-auto p-6 space-y-6">
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-bold">上架商品（競標）</h1>
      <NuxtLink to="/market" class="text-sm text-gray-500 hover:underline">← 競標市場</NuxtLink>
    </div>

    <div v-if="!isConnected" class="border rounded-lg p-4 bg-amber-50 text-amber-800">
      請先連接錢包，以使用您的地址作為賣家。
    </div>

    <form v-else class="grid gap-4 border rounded-lg p-6 bg-white shadow-sm" @submit.prevent="publish">
      <div>
        <label class="text-sm font-medium">商品標題</label>
        <input v-model="form.title" class="mt-1 w-full border rounded p-2" required />
      </div>
      <div>
        <label class="text-sm font-medium">說明</label>
        <textarea v-model="form.description" class="mt-1 w-full border rounded p-2" rows="4" required />
      </div>
      <div class="grid grid-cols-2 gap-4">
        <div>
          <label class="text-sm font-medium">結標時間</label>
          <input v-model="form.endTime" type="datetime-local" class="mt-1 w-full border rounded p-2" required />
        </div>
        <div>
          <label class="text-sm font-medium">最低出價 (XRP，選填)</label>
          <input v-model="form.minBidXrp" type="number" step="0.1" min="0" class="mt-1 w-full border rounded p-2" placeholder="0" />
        </div>
      </div>
      <div>
        <label class="text-sm font-medium">圖片 URL（選填）</label>
        <input v-model="form.imageUrl" type="url" class="mt-1 w-full border rounded p-2" placeholder="https://..." />
      </div>
      <button
        type="submit"
        class="border rounded px-4 py-2 w-fit bg-accent text-white hover:bg-accent/90 disabled:opacity-50"
        :disabled="isSubmitting"
      >
        {{ isSubmitting ? '上架中…' : '上架商品' }}
      </button>
      <p v-if="createdId" class="text-sm text-green-700">
        已建立！<NuxtLink :to="`/auction/${createdId}`" class="underline">前往競標頁</NuxtLink>
        ，或到「競標市場」為此商品提交上鏈憑證。
      </p>
    </form>
  </div>
</template>

<script setup lang="ts">
const { isConnected, accountInfo } = useWallet()

const form = reactive({
  title: '',
  description: '',
  endTime: '',
  minBidXrp: '' as string | number,
  imageUrl: '',
})
const isSubmitting = ref(false)
const createdId = ref('')

async function publish() {
  if (!accountInfo.value?.address) return
  const endTime = new Date(form.endTime).toISOString()
  if (Number.isNaN(new Date(form.endTime).getTime())) return
  const minBidXrp = form.minBidXrp === '' ? undefined : Number(form.minBidXrp)
  if (minBidXrp != null && (!Number.isFinite(minBidXrp) || minBidXrp < 0)) return

  isSubmitting.value = true
  try {
    const listing = await $fetch<{ id: string }>('/api/listings', {
      method: 'POST',
      body: {
        title: form.title,
        description: form.description,
        sellerAddress: accountInfo.value.address,
        endTime,
        minBidXrp,
        imageUrl: form.imageUrl || undefined,
      },
    })
    createdId.value = listing.id
  } catch (e) {
    console.error(e)
  } finally {
    isSubmitting.value = false
  }
}
</script>

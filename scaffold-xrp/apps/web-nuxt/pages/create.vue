<template>
  <div class="max-w-3xl mx-auto p-6 space-y-6">
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-bold">Create Auction</h1>
    </div>

    <div class="grid gap-4">
      <div>
        <label class="text-sm">Title</label>
        <input v-model="form.title" class="mt-1 w-full border rounded p-2" placeholder="e.g. iPhone 15 Pro 256GB" />
      </div>

      <div>
        <label class="text-sm">Description</label>
        <textarea v-model="form.description" class="mt-1 w-full border rounded p-2" rows="4" placeholder="Item details" />
      </div>

      <div class="grid grid-cols-2 gap-4">
        <div>
          <label class="text-sm">Start Price (XRP)</label>
          <input v-model="form.startPriceXrp" class="mt-1 w-full border rounded p-2" type="number" step="0.1" min="0" />
        </div>
        <div>
          <label class="text-sm">Min Increment (XRP)</label>
          <input v-model="form.minIncrementXrp" class="mt-1 w-full border rounded p-2" type="number" step="0.1" min="0" />
        </div>
      </div>

      <div>
        <label class="text-sm">Reserve Price (XRP, optional)</label>
        <input v-model="form.reserveXrp" class="mt-1 w-full border rounded p-2" type="number" step="0.1" min="0" placeholder="Set 0 for no reserve" />
      </div>

      <div class="grid grid-cols-3 gap-4">
        <div>
          <label class="text-sm">Start Time</label>
          <input v-model="form.startTime" type="datetime-local" class="mt-1 w-full border rounded p-2" />
        </div>
        <div>
          <label class="text-sm">End Time</label>
          <input v-model="form.endTime" type="datetime-local" class="mt-1 w-full border rounded p-2" />
        </div>
        <div>
          <label class="text-sm">Item Image</label>
          <input type="file" accept="image/*" class="mt-1 w-full border rounded p-2" @change="onSelectImage" />
          <div class="text-xs text-gray-500 mt-1">
            {{ selectedImage ? selectedImage.name : 'No file selected' }}
          </div>
        </div>
      </div>

      <button class="btn-primary disabled:opacity-50" :disabled="isPublishing" @click="publishAuction">
        {{ isPublishing ? 'Publishing...' : 'Publish Auction' }}
      </button>

      <div v-if="result" class="text-sm border rounded p-3 bg-green-50">
        <div><b>Auction ID:</b> {{ result.auctionId }}</div>
        <div><b>Image CID:</b> {{ result.imageCid }}</div>
        <div><b>Meta CID (desc_hash):</b> {{ result.metaCid }}</div>
        <div><b>Anchor Tx:</b> {{ result.txHash }}</div>
      </div>

      <pre class="text-xs bg-gray-50 border rounded p-3 overflow-auto">{{ preview }}</pre>
    </div>
  </div>
</template>

<script setup lang="ts">
import { XRP_TO_DROPS } from '~/lib/auction'
import { useWallet } from '~/composables/useWallet'
import { useAuctionTx } from '~/composables/useAuctionTx'

const { walletManager, accountInfo, showStatus, addEvent } = useWallet()
const { publishAuctionCreate } = useAuctionTx()

const form = reactive({
  title: '',
  description: '',
  startPriceXrp: '10',
  minIncrementXrp: '1',
  reserveXrp: '0',
  startTime: '',
  endTime: '',
})

const selectedImage = ref<File | null>(null)
const isPublishing = ref(false)
const result = ref<{
  auctionId: string
  imageCid: string
  metaCid: string
  txHash: string
} | null>(null)

const preview = computed(() => ({
  ...form,
  seller: accountInfo.value?.address || '(connect wallet first)',
  image: selectedImage.value?.name || '(no image)',
}))

const MOCK_AUCTIONS_KEY = 'mock_auctions_v1'

interface MockAuction {
  id: string
  title: string
  description: string
  imageCid: string
  metaCid: string
  startPriceXrp: string
  minIncrementXrp: string
  startTime: string
  endTime: string
  anchorTxHash: string
  sellerAddress: string
  createdAt: string
}

function onSelectImage(event: Event) {
  const input = event.target as HTMLInputElement
  selectedImage.value = input.files?.[0] || null
}

async function publishAuction() {
  const sellerAddress = walletManager.value?.account?.address
  if (!walletManager.value || !sellerAddress) {
    showStatus('Please connect a wallet first', 'error')
    return
  }

  if (!form.title || !form.startTime || !form.endTime) {
    showStatus('Please complete title, start time, and end time', 'error')
    return
  }
  if (!selectedImage.value) {
    showStatus('Please upload an item image before publishing', 'error')
    return
  }

  const startTs = Math.floor(Date.parse(form.startTime) / 1000)
  const endTs = Math.floor(Date.parse(form.endTime) / 1000)
  if (Number.isNaN(startTs) || Number.isNaN(endTs) || endTs <= startTs) {
    showStatus('End time must be later than start time', 'error')
    return
  }

  const auctionId = `A2026-${String(Date.now()).slice(-6)}`
  isPublishing.value = true
  result.value = null

  try {
    const uploadForm = new FormData()
    uploadForm.append('image', selectedImage.value)
    uploadForm.append('auctionId', auctionId)
    uploadForm.append('title', form.title)
    uploadForm.append('description', form.description)
    uploadForm.append('startPriceXrp', form.startPriceXrp)
    uploadForm.append('minIncrementXrp', form.minIncrementXrp)
    uploadForm.append('startTime', new Date(startTs * 1000).toISOString())
    uploadForm.append('endTime', new Date(endTs * 1000).toISOString())
    uploadForm.append('sellerAddress', sellerAddress)

    const uploadResp = await $fetch<{ imageCid: string; metaCid: string }>('/api/auction/upload-metadata', {
      method: 'POST',
      body: uploadForm,
    })

    const minIncrementDrops = String(Math.round(parseFloat(form.minIncrementXrp) * XRP_TO_DROPS))
    const reserveDrops = String(Math.round((parseFloat(form.reserveXrp) || 0) * XRP_TO_DROPS))

    const payload = {
      type: 'AUCTION_CREATE' as const,
      auction_id: auctionId,
      seller: sellerAddress,
      title: form.title,
      desc_hash: uploadResp.metaCid,
      start_time: startTs,
      end_time: endTs,
      currency: 'XRP',
      min_increment_drops: minIncrementDrops,
      reserve_drops: reserveDrops,
      shipping_policy_hash: '',
    }

    const txResult = await publishAuctionCreate(payload)
    const txHash = txResult?.hash || txResult?.id || 'pending'

    const record: MockAuction = {
      id: auctionId,
      title: form.title,
      description: form.description,
      imageCid: uploadResp.imageCid,
      metaCid: uploadResp.metaCid,
      startPriceXrp: form.startPriceXrp,
      minIncrementXrp: form.minIncrementXrp,
      startTime: new Date(startTs * 1000).toISOString(),
      endTime: new Date(endTs * 1000).toISOString(),
      anchorTxHash: txHash,
      sellerAddress,
      createdAt: new Date().toISOString(),
    }

    if (process.client) {
      const raw = localStorage.getItem(MOCK_AUCTIONS_KEY)
      const list = raw ? (JSON.parse(raw) as MockAuction[]) : []
      localStorage.setItem(MOCK_AUCTIONS_KEY, JSON.stringify([record, ...list]))
    }

    result.value = {
      auctionId,
      imageCid: uploadResp.imageCid,
      metaCid: uploadResp.metaCid,
      txHash,
    }

    addEvent('Auction Published', result.value)
    showStatus('Auction published successfully', 'success')
  } catch (error: any) {
    const msg = error?.data?.statusMessage || error?.message || 'Publish failed'
    showStatus(`Publish failed: ${msg}`, 'error')
  } finally {
    isPublishing.value = false
  }
}
</script>
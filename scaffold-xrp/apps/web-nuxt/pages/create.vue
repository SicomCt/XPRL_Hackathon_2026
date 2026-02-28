<template>
  <div class="max-w-3xl mx-auto p-6 space-y-6">
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-bold">Create Auction</h1>
    </div>

    <div class="grid gap-4">
      <div>
        <label class="text-sm">Title</label>
        <input v-model="form.title" class="mt-1 w-full border rounded p-2" />
      </div>

      <div>
        <label class="text-sm">Description</label>
        <textarea v-model="form.description" class="mt-1 w-full border rounded p-2" rows="4" />
      </div>

      <div class="grid grid-cols-2 gap-4">
        <div>
          <label class="text-sm">Start Price (XRP)</label>
          <input v-model="form.startPriceXrp" class="mt-1 w-full border rounded p-2" />
        </div>
        <div>
          <label class="text-sm">Min Increment (XRP)</label>
          <input v-model="form.minIncrementXrp" class="mt-1 w-full border rounded p-2" />
        </div>
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
          <label class="text-sm">Photo File</label>
          <input type="file" accept="image/*" class="mt-1 w-full border rounded p-2" @change="onSelectImage" />
          <div class="text-xs text-gray-500 mt-1">
            {{ selectedImage ? selectedImage.name : 'No image selected' }}
          </div>
        </div>
      </div>

      <button class="border rounded px-4 py-2 w-fit disabled:opacity-50" :disabled="isPublishing" @click="publishAuction">
        {{ isPublishing ? 'Publishing...' : 'Publish (web3 + on-chain)' }}
      </button>

      <div v-if="result" class="text-sm border rounded p-3 bg-gray-50">
        <div><b>Auction ID:</b> {{ result.auctionId }}</div>
        <div><b>Image CID:</b> {{ result.imageCid }}</div>
        <div><b>Meta CID:</b> {{ result.metaCid }}</div>
        <div><b>Anchor Tx:</b> {{ result.txHash }}</div>
      </div>

      <pre class="text-xs bg-gray-50 border rounded p-3 overflow-auto">{{ preview }}</pre>
    </div>
  </div>
</template>

<script setup lang="ts">
import { xrpToDrops } from 'xrpl'

const { walletManager, accountInfo, showStatus, addEvent } = useWallet()

const form = reactive({
  title: "",
  description: "",
  startPriceXrp: "10",
  minIncrementXrp: "1",
  startTime: "",
  endTime: "",
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
  note: "下一步：photo+metadata 上传 web3.storage，拿到 metaCID 后再做 AUCTION_CREATE 上链锚点",
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

function toHex(text: string): string {
  return Array.from(new TextEncoder().encode(text))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase()
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
    showStatus('请至少填写标题、开始时间、结束时间', 'error')
    return
  }
  if (!selectedImage.value) {
    showStatus('请选择商品图片后再发布', 'error')
    return
  }

  const startTs = Date.parse(form.startTime)
  const endTs = Date.parse(form.endTime)
  if (Number.isNaN(startTs) || Number.isNaN(endTs) || endTs <= startTs) {
    showStatus('结束时间必须晚于开始时间', 'error')
    return
  }

  const auctionId = `auc_${Date.now()}`
  isPublishing.value = true
  result.value = null

  try {
    // 1) Upload image + metadata to web3.storage via Nuxt server route.
    const uploadForm = new FormData()
    uploadForm.append('image', selectedImage.value)
    uploadForm.append('auctionId', auctionId)
    uploadForm.append('title', form.title)
    uploadForm.append('description', form.description)
    uploadForm.append('startPriceXrp', form.startPriceXrp)
    uploadForm.append('minIncrementXrp', form.minIncrementXrp)
    uploadForm.append('startTime', new Date(startTs).toISOString())
    uploadForm.append('endTime', new Date(endTs).toISOString())
    uploadForm.append('sellerAddress', sellerAddress)

    const uploadResp = await $fetch<{ imageCid: string; metaCid: string }>('/api/auction/upload-metadata', {
      method: 'POST',
      body: uploadForm,
    })

    // 2) Create AUCTION_CREATE on-chain anchor with memo containing auction metadata pointer.
    const memoPayload = JSON.stringify({
      action: 'AUCTION_CREATE',
      auctionId,
      metaCid: uploadResp.metaCid,
      imageCid: uploadResp.imageCid,
      startTime: new Date(startTs).toISOString(),
      endTime: new Date(endTs).toISOString(),
      minIncrementXrp: form.minIncrementXrp,
      startPriceXrp: form.startPriceXrp,
    })

    const tx = {
      TransactionType: 'Payment' as const,
      Account: sellerAddress,
      Destination: sellerAddress,
      Amount: xrpToDrops('0.000001'),
      Fee: '12',
      Memos: [
        {
          Memo: {
            MemoType: toHex('AUCTION_CREATE'),
            MemoData: toHex(memoPayload),
          },
        },
      ],
    }

    const txResult = await walletManager.value.signAndSubmit(tx as any)
    const txHash = txResult.hash || txResult.id || 'pending'

  const record: MockAuction = {
    id: auctionId,
    title: form.title,
    description: form.description,
    imageCid: uploadResp.imageCid,
    metaCid: uploadResp.metaCid,
    startPriceXrp: form.startPriceXrp,
    minIncrementXrp: form.minIncrementXrp,
    startTime: new Date(startTs).toISOString(),
    endTime: new Date(endTs).toISOString(),
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
    showStatus('Auction published: web3 metadata + on-chain anchor completed', 'success')
  } catch (error: any) {
    const msg = error?.data?.statusMessage || error?.message || 'Publish failed'
    showStatus(`Publish failed: ${msg}`, 'error')
  } finally {
    isPublishing.value = false
  }
}
</script>
<template>
  <div class="max-w-3xl mx-auto p-6 space-y-6">
    <div class="flex items-center justify-between">
      <NuxtLink to="/market" class="text-sm text-gray-500 hover:underline">← 返回競標市場</NuxtLink>
      <h1 class="text-2xl font-bold">競標：{{ listing?.title ?? id }}</h1>
    </div>

    <div v-if="loading" class="text-gray-500">載入中…</div>
    <div v-else-if="!listing" class="text-red-600">找不到此商品</div>

    <template v-else>
      <div class="border rounded-lg p-4 space-y-2 bg-white shadow-sm">
        <div class="flex items-center gap-2">
          <span class="text-sm text-gray-600">上鏈驗證</span>
          <span
            v-if="listing.attestationTxHash"
            class="text-xs px-2 py-0.5 rounded bg-green-100 text-green-800"
          >
            已上鍊
          </span>
          <span v-else class="text-xs px-2 py-0.5 rounded bg-amber-100 text-amber-800">未上鍊</span>
        </div>
        <p v-if="listing.attestationTxHash" class="text-xs text-gray-500 break-all">
          憑證交易：{{ listing.attestationTxHash }}
        </p>
        <div v-else-if="isSeller" class="mt-2">
          <button
            type="button"
            class="text-sm px-3 py-1.5 rounded bg-gray-800 text-white hover:bg-gray-700 disabled:opacity-50"
            :disabled="isAttesting"
            @click="submitAttestation"
          >
            {{ isAttesting ? '提交中…' : '提交上鏈憑證（Payment + Memo）' }}
          </button>
          <p class="text-xs text-gray-500 mt-1">發送一筆帶 Memo 的 Payment 至平台，作為商品憑證上鏈</p>
        </div>
        <div><b>商品說明：</b>{{ listing.description }}</div>
        <div><b>結標時間：</b>{{ listing.endTime }}</div>
        <div v-if="listing.minBidXrp"><b>最低出價：</b>{{ listing.minBidXrp }} XRP</div>
      </div>

      <div v-if="listing.status === 'active'" class="border rounded-lg p-4 space-y-3 bg-white shadow-sm">
        <h2 class="font-semibold">出價（Smart Escrow 鎖倉）</h2>
        <p class="text-sm text-gray-600">
          出價將以 EscrowCreate 鎖住 XRP，結標後由平台/賣家 EscrowFinish 釋放給得標者。
        </p>
        <div>
          <label class="text-sm">出價金額 (XRP)</label>
          <input v-model="bidXrp" type="text" class="mt-1 w-full border rounded p-2" placeholder="10" />
        </div>
        <button
          class="border rounded px-4 py-2 bg-accent text-white hover:bg-accent/90 disabled:opacity-50"
          :disabled="isBidding"
          @click="placeBid"
        >
          {{ isBidding ? '提交中…' : '出價（上鏈 Escrow）' }}
        </button>
      </div>

      <div v-else class="text-gray-500">此競標已結束或已取消</div>

      <div class="border rounded-lg p-4">
        <h2 class="font-semibold mb-2">我的出價記錄</h2>
        <p class="text-xs text-gray-500 mb-2">由平台記錄的 Escrow 出價（實際以鏈上為準）</p>
        <ul class="text-sm list-disc ml-5 space-y-1">
          <li v-for="(b, i) in bidRecords" :key="i">
            {{ b.owner.slice(0, 8) }}… 出價 {{ b.amountXrp }} XRP（tx: {{ b.txHash.slice(0, 12) }}…）
          </li>
        </ul>
        <p v-if="bidRecords.length === 0" class="text-gray-400">尚無出價記錄</p>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
const route = useRoute()
const config = useRuntimeConfig()
const id = computed(() => (route.params.id as string) ?? '')

const listing = ref<{
  id: string
  title: string
  description: string
  endTime: string
  minBidXrp?: number
  status: string
  attestationTxHash?: string
  sellerAddress?: string
} | null>(null)
const loading = ref(true)
const bidXrp = ref('')
const isBidding = ref(false)
const isAttesting = ref(false)
const bidRecords = ref<{ owner: string; amountXrp: string; txHash: string }[]>([])
const { accountInfo, walletManager, showStatus } = useWallet()
const isSeller = computed(() => listing.value?.sellerAddress && accountInfo.value?.address && listing.value.sellerAddress === accountInfo.value.address)

const RIPPLE_EPOCH = 946684800
function toRippleTime(date: Date): number {
  return Math.floor(date.getTime() / 1000) - RIPPLE_EPOCH
}

async function loadListing() {
  if (!id.value) return
  loading.value = true
  try {
    const data = await $fetch<typeof listing.value>(`/api/listings/${id.value}`)
    listing.value = data
  } catch {
    listing.value = null
  } finally {
    loading.value = false
  }
}

async function loadBidRecords() {
  if (!id.value) return
  try {
    const bids = await $fetch<{ owner: string; amountXrp: string; txHash: string }[]>(
      '/api/bids',
      { query: { auctionId: id.value } }
    )
    bidRecords.value = bids ?? []
  } catch {
    bidRecords.value = []
  }
}

const { createBidEscrow } = useEscrow()

async function placeBid() {
  if (!listing.value || listing.value.status !== 'active') return
  const amount = parseFloat(bidXrp.value)
  if (!Number.isFinite(amount) || amount <= 0) return
  const platformAddress = config.public.platformEscrowAddress as string
  const endDate = new Date(listing.value.endTime)
  const finishAfter = toRippleTime(endDate)
  if (finishAfter <= 0) return

  isBidding.value = true
  try {
    const result = await createBidEscrow(id.value, amount, finishAfter, platformAddress)
    if (result && walletManager.value?.account) {
      await $fetch('/api/bids', {
        method: 'POST',
        body: {
          auctionId: id.value,
          owner: walletManager.value.account.address,
          offerSequence: result.offerSequence,
          amountXrp: String(amount),
          txHash: result.hash,
        },
      })
      bidXrp.value = ''
      await loadBidRecords()
    }
  } finally {
    isBidding.value = false
  }
}

async function submitAttestation() {
  if (!listing.value || !walletManager.value?.account || !isSeller.value) return
  const platformAddress = config.public.platformEscrowAddress as string
  const toHex = (s: string) =>
    Array.from(new TextEncoder().encode(s))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase()
  isAttesting.value = true
  try {
    const tx = {
      TransactionType: 'Payment' as const,
      Account: walletManager.value.account.address,
      Destination: platformAddress,
      Amount: '1',
      Fee: '12',
      Memos: [{ Memo: { MemoData: toHex(listing.value.id), MemoType: toHex('listing_attestation') } }],
    }
    const result = await walletManager.value.signAndSubmit(tx as any)
    const hash = result?.hash ?? result?.id
    if (hash) {
      await $fetch(`/api/listings/${id.value}`, {
        method: 'PATCH',
        body: { attestationTxHash: hash },
      })
      await loadListing()
      showStatus('上鏈憑證已提交', 'success')
    }
  } catch (e) {
    showStatus(String(e instanceof Error ? e.message : e), 'error')
  } finally {
    isAttesting.value = false
  }
}

onMounted(() => {
  loadListing()
  loadBidRecords()
})
</script>

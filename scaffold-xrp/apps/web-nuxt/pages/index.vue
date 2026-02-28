<script setup lang="ts">
useHead({
  title: 'XRPL Auction Marketplace',
})

const MAX_POINTS = 180
const CHART_WIDTH = 1200
const CHART_HEIGHT = 320
const CHART_PADDING = 16

interface PricePoint {
  ts: number
  usd: number
  aud: number
  cny: number
}

const priceHistory = ref<PricePoint[]>([])
const xrpUpdatedAt = ref<Date | null>(null)
const xrpPriceLoading = ref(true)
const xrpPriceError = ref('')
const rangeDays = ref(180)

async function loadXrpPrice() {
  try {
    const resp = await $fetch<{ rangeDays: number; points: PricePoint[] }>('/api/market/xrp')
    const points = resp?.points ?? []
    if (!points.length) {
      throw new Error('Price not available')
    }
    priceHistory.value = points.slice(-MAX_POINTS)
    rangeDays.value = resp.rangeDays || 180
    xrpUpdatedAt.value = new Date()
    xrpPriceError.value = ''
  } catch {
    xrpPriceError.value = 'Failed to load price'
  } finally {
    xrpPriceLoading.value = false
  }
}

function getSeriesRange(values: number[]) {
  const min = Math.min(...values)
  const max = Math.max(...values)
  if (min === max) {
    // Prevent a flat series from producing divide-by-zero.
    return { min: min - 0.001, max: max + 0.001 }
  }
  return { min, max }
}

const allSeriesRange = computed(() => {
  const allValues = [...usdSeries.value, ...audSeries.value, ...cnySeries.value]
  if (!allValues.length) {
    return { min: 0, max: 1 }
  }
  return getSeriesRange(allValues)
})

function buildPolyline(values: number[], range: { min: number; max: number }): string {
  if (!values.length) return ''
  const { min, max } = range
  const plotWidth = CHART_WIDTH - CHART_PADDING * 2
  const plotHeight = CHART_HEIGHT - CHART_PADDING * 2
  const stepX = values.length > 1 ? plotWidth / (values.length - 1) : 0
  const points = values
    .map((v, i) => {
      const x = CHART_PADDING + i * stepX
      const y = CHART_PADDING + (1 - (v - min) / (max - min)) * plotHeight
      return `${x.toFixed(2)},${y.toFixed(2)}`
    })
  if (points.length === 1) {
    // With one sample, draw a horizontal baseline so users can see it immediately.
    const y = points[0].split(',')[1]
    return `${CHART_PADDING},${y} ${CHART_WIDTH - CHART_PADDING},${y}`
  }
  return points.join(' ')
}

const usdSeries = computed(() => priceHistory.value.map((p) => p.usd))
const audSeries = computed(() => priceHistory.value.map((p) => p.aud))
const cnySeries = computed(() => priceHistory.value.map((p) => p.cny))

const usdPolyline = computed(() => buildPolyline(usdSeries.value, allSeriesRange.value))
const audPolyline = computed(() => buildPolyline(audSeries.value, allSeriesRange.value))
const cnyPolyline = computed(() => buildPolyline(cnySeries.value, allSeriesRange.value))

function getLastPoint(points: string): string {
  const arr = points.trim().split(' ')
  return arr[arr.length - 1] || ''
}

const usdLastPoint = computed(() => getLastPoint(usdPolyline.value))
const audLastPoint = computed(() => getLastPoint(audPolyline.value))
const cnyLastPoint = computed(() => getLastPoint(cnyPolyline.value))

const plotWidth = computed(() => CHART_WIDTH - CHART_PADDING * 2)
const plotHeight = computed(() => CHART_HEIGHT - CHART_PADDING * 2)

function getXByIndex(index: number, len: number): number {
  if (len <= 1) return CHART_PADDING
  return CHART_PADDING + (index / (len - 1)) * plotWidth.value
}

function getYBySeries(values: number[], index: number): number {
  if (!values.length) return CHART_HEIGHT - CHART_PADDING
  const { min, max } = allSeriesRange.value
  const v = values[Math.max(0, Math.min(index, values.length - 1))]
  return CHART_PADDING + (1 - (v - min) / (max - min)) * plotHeight.value
}

const xAxisTicks = computed(() => {
  const len = priceHistory.value.length
  if (!len) return [] as Array<{ index: number; x: number; label: string }>
  const tickCount = Math.min(6, len)
  return Array.from({ length: tickCount }, (_, i) => {
    const ratio = tickCount === 1 ? 0 : i / (tickCount - 1)
    const index = Math.round(ratio * (len - 1))
    const point = priceHistory.value[index]
    const x = getXByIndex(index, len)
    const label = new Date(point.ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    return { index, x, label }
  })
})

const hoverIndex = ref<number | null>(null)

const hoveredPoint = computed(() => {
  if (hoverIndex.value == null) return null
  return priceHistory.value[hoverIndex.value] ?? null
})

const hoverX = computed(() => {
  if (hoverIndex.value == null) return null
  return getXByIndex(hoverIndex.value, priceHistory.value.length)
})

const hoverUsdY = computed(() => {
  if (hoverIndex.value == null) return null
  return getYBySeries(usdSeries.value, hoverIndex.value)
})

const hoverAudY = computed(() => {
  if (hoverIndex.value == null) return null
  return getYBySeries(audSeries.value, hoverIndex.value)
})

const hoverCnyY = computed(() => {
  if (hoverIndex.value == null) return null
  return getYBySeries(cnySeries.value, hoverIndex.value)
})

const tooltipX = computed(() => {
  if (hoverX.value == null) return CHART_PADDING
  const preferred = hoverX.value + 12
  return Math.min(preferred, CHART_WIDTH - 180)
})

const tooltipY = computed(() => CHART_PADDING + 8)

function onChartMouseMove(event: MouseEvent) {
  const svg = event.currentTarget as SVGSVGElement
  const rect = svg.getBoundingClientRect()
  const rawX = ((event.clientX - rect.left) / rect.width) * CHART_WIDTH
  const clampedX = Math.min(CHART_WIDTH - CHART_PADDING, Math.max(CHART_PADDING, rawX))
  const len = priceHistory.value.length
  if (!len) {
    hoverIndex.value = null
    return
  }
  const ratio = (clampedX - CHART_PADDING) / Math.max(1, plotWidth.value)
  hoverIndex.value = Math.max(0, Math.min(len - 1, Math.round(ratio * (len - 1))))
}

function onChartMouseLeave() {
  hoverIndex.value = null
}

const latestPrice = computed(() => {
  return priceHistory.value[priceHistory.value.length - 1] ?? null
})

const firstLabel = computed(() => {
  const first = priceHistory.value[0]
  if (!first) return '--'
  return new Date(first.ts).toLocaleDateString()
})

const formattedUpdatedAt = computed(() => {
  if (!xrpUpdatedAt.value) return '--'
  return xrpUpdatedAt.value.toLocaleDateString()
})

let priceTimer: ReturnType<typeof setInterval> | null = null

onMounted(() => {
  loadXrpPrice()
  priceTimer = setInterval(loadXrpPrice, 10 * 60_000)
})

onBeforeUnmount(() => {
  if (priceTimer) clearInterval(priceTimer)
})
</script>

<template>
  <div class="min-h-screen">
    <main class="container mx-auto px-4 py-8">
      <div class="mb-8">
        <h1 class="text-4xl font-bold mb-2 tech-title">XRPL Auction Marketplace</h1>
        <p class="text-gray-600">
          Create auctions, place bids, and settle payments with XRPL Escrow.
        </p>
        <div class="mt-3 rounded-lg border p-4 tech-panel">
          <template v-if="xrpPriceLoading">Loading XRP price...</template>
          <template v-else-if="xrpPriceError">{{ xrpPriceError }}</template>
          <template v-else>
            <div class="flex flex-wrap items-center gap-4 text-sm mb-3">
              <span class="font-medium">XRP Market Trend</span>
              <span class="font-mono text-blue-700">USD {{ latestPrice ? latestPrice.usd.toFixed(4) : '--' }}</span>
              <span class="font-mono text-emerald-700">AUD {{ latestPrice ? latestPrice.aud.toFixed(4) : '--' }}</span>
              <span class="font-mono text-amber-700">CNY {{ latestPrice ? latestPrice.cny.toFixed(4) : '--' }}</span>
              <span class="text-gray-500">Updated: {{ formattedUpdatedAt }}</span>
            </div>

            <svg
              :viewBox="`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`"
              class="w-full h-80 rounded bg-white"
              @mousemove="onChartMouseMove"
              @mouseleave="onChartMouseLeave"
            >
              <line
                :x1="CHART_PADDING"
                :y1="CHART_HEIGHT - CHART_PADDING"
                :x2="CHART_WIDTH - CHART_PADDING"
                :y2="CHART_HEIGHT - CHART_PADDING"
                stroke="#e5e7eb"
              />
              <line
                :x1="CHART_PADDING"
                :y1="CHART_PADDING"
                :x2="CHART_PADDING"
                :y2="CHART_HEIGHT - CHART_PADDING"
                stroke="#e5e7eb"
              />

              <polyline fill="none" stroke="#2563eb" stroke-width="2.5" :points="usdPolyline" />
              <polyline fill="none" stroke="#059669" stroke-width="2.5" :points="audPolyline" />
              <polyline fill="none" stroke="#d97706" stroke-width="2.5" :points="cnyPolyline" />
              <circle v-if="usdLastPoint" :cx="usdLastPoint.split(',')[0]" :cy="usdLastPoint.split(',')[1]" r="3.5" fill="#2563eb" />
              <circle v-if="audLastPoint" :cx="audLastPoint.split(',')[0]" :cy="audLastPoint.split(',')[1]" r="3.5" fill="#059669" />
              <circle v-if="cnyLastPoint" :cx="cnyLastPoint.split(',')[0]" :cy="cnyLastPoint.split(',')[1]" r="3.5" fill="#d97706" />

              <g v-for="tick in xAxisTicks" :key="tick.index">
                <line
                  :x1="tick.x"
                  :x2="tick.x"
                  :y1="CHART_HEIGHT - CHART_PADDING"
                  :y2="CHART_HEIGHT - CHART_PADDING + 6"
                  stroke="#9ca3af"
                />
                <text
                  :x="tick.x"
                  :y="CHART_HEIGHT - 4"
                  text-anchor="middle"
                  font-size="10"
                  fill="#6b7280"
                >
                  {{ tick.label }}
                </text>
              </g>

              <line
                v-if="hoverX != null"
                :x1="hoverX"
                :x2="hoverX"
                :y1="CHART_PADDING"
                :y2="CHART_HEIGHT - CHART_PADDING"
                stroke="#9ca3af"
                stroke-dasharray="3 3"
              />
              <circle v-if="hoverX != null && hoverUsdY != null" :cx="hoverX" :cy="hoverUsdY" r="4" fill="#2563eb" />
              <circle v-if="hoverX != null && hoverAudY != null" :cx="hoverX" :cy="hoverAudY" r="4" fill="#059669" />
              <circle v-if="hoverX != null && hoverCnyY != null" :cx="hoverX" :cy="hoverCnyY" r="4" fill="#d97706" />

              <g v-if="hoveredPoint" :transform="`translate(${tooltipX}, ${tooltipY})`">
                <rect width="168" height="64" rx="6" fill="white" stroke="#d1d5db" />
                <text x="8" y="14" font-size="10" fill="#4b5563">{{ new Date(hoveredPoint.ts).toLocaleDateString() }}</text>
                <text x="8" y="30" font-size="10" fill="#2563eb">USD: {{ hoveredPoint.usd.toFixed(4) }}</text>
                <text x="8" y="44" font-size="10" fill="#059669">AUD: {{ hoveredPoint.aud.toFixed(4) }}</text>
                <text x="8" y="58" font-size="10" fill="#d97706">CNY: {{ hoveredPoint.cny.toFixed(4) }}</text>
              </g>
            </svg>

            <div class="mt-2 flex flex-wrap items-center gap-4 text-xs text-gray-600">
              <span><span class="inline-block w-3 h-0.5 bg-blue-600 mr-1 align-middle" /> USD</span>
              <span><span class="inline-block w-3 h-0.5 bg-emerald-600 mr-1 align-middle" /> AUD</span>
              <span><span class="inline-block w-3 h-0.5 bg-amber-600 mr-1 align-middle" /> CNY</span>
              <span>Period: Last {{ rangeDays }} days ({{ firstLabel }} - {{ formattedUpdatedAt }})</span>
            </div>
          </template>
        </div>
      </div>

      <div class="mb-8 grid grid-cols-1 md:grid-cols-2 gap-4">
        <NuxtLink
          to="/auctions"
          class="card hover:shadow-lg transition-shadow block"
        >
          <h2 class="text-xl font-bold mb-2">Browse Auctions</h2>
          <p class="text-sm text-gray-600">View active and ended auctions with bid history</p>
        </NuxtLink>
        <NuxtLink
          to="/create"
          class="card hover:shadow-lg transition-shadow block"
        >
          <h2 class="text-xl font-bold mb-2">Create a New Auction</h2>
          <p class="text-sm text-gray-600">List your item and publish metadata on-chain</p>
        </NuxtLink>
      </div>

      <div class="mb-6">
        <NuxtLink
          to="/me"
          class="card hover:shadow-lg transition-shadow block"
        >
          <h2 class="text-xl font-bold mb-2">My Bids</h2>
          <p class="text-sm text-gray-600">Track your bids, payment status, and refunds</p>
        </NuxtLink>
      </div>

      <div class="mt-8 border rounded-lg p-6 tech-panel">
        <h2 class="text-xl font-bold mb-3">Quick Overview</h2>
        <div class="space-y-2 text-sm">
          <p>1. <b>Create</b>: Seller publishes auction details and item metadata.</p>
          <p>2. <b>Bid</b>: Bidder locks funds with EscrowCreate and records a BID event.</p>
          <p>3. <b>Settle</b>: Winner completes EscrowFinish, non-winners use EscrowCancel.</p>
          <p>4. <b>Deliver</b>: Seller and buyer submit shipping and receipt confirmations.</p>
        </div>
      </div>
    </main>

    <footer class="border-t border-gray-200 mt-16">
      <div class="container mx-auto px-4 py-6 text-center text-gray-600">
        <p>Built with Scaffold-XRP · On-Chain Auction MVP</p>
      </div>
    </footer>
  </div>
</template>

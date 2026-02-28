<template>
  <div class="max-w-4xl mx-auto p-6">
    <div v-if="loading" class="text-center py-12">加载中...</div>
    <div v-else-if="!auction" class="text-center py-12 text-gray-500">未找到该拍品</div>
    <div v-else class="space-y-6">
      <div class="card">
        <h1 class="text-2xl font-bold">{{ auction.auction.title }}</h1>
        <p class="text-sm text-gray-500">ID: {{ auction.auction.auction_id }}</p>
        <p>卖家: {{ auction.auction.seller }}</p>
        <p>详情 Hash: {{ auction.auction.desc_hash }}</p>
        <p>起拍保留价: {{ dropsToXrp(auction.auction.reserve_drops) }} XRP</p>
        <p>最低加价: {{ dropsToXrp(auction.auction.min_increment_drops) }} XRP</p>
        <p>
          时间: {{ formatTime(auction.auction.start_time) }} ~ {{ formatTime(auction.auction.end_time) }}
          <span :class="isEnded ? 'text-orange-600' : 'text-green-600'">
            {{ isEnded ? '(已结束)' : '(进行中)' }}
          </span>
        </p>
      </div>

      <div class="card">
        <h2 class="font-bold mb-4">出价记录</h2>
        <div class="space-y-2">
          <div
            v-for="(b, i) in sortedBids"
            :key="i"
            class="flex justify-between py-2 border-b last:border-0"
          >
            <span>{{ b.payload.bidder }} (escrow_seq: {{ b.payload.escrow_seq }})</span>
            <span class="font-mono">{{ dropsToXrp(b.payload.bid_drops) }} XRP</span>
          </div>
          <div v-if="!auction.bids.length" class="text-gray-500">暂无出价</div>
        </div>
      </div>

      <!-- 出价表单（未结束时） -->
      <div v-if="!isEnded && isConnected" class="card">
        <h2 class="font-bold mb-4">出价 (Escrow 锁款 + BID 上链)</h2>
        <div class="flex gap-4 items-end">
          <div class="flex-1">
            <label class="block text-sm mb-1">出价金额 (XRP)</label>
            <input
              v-model.number="bidXrp"
              type="number"
              step="0.1"
              min="0"
              class="input"
              placeholder="例如 52"
            />
          </div>
          <button
            class="btn-primary disabled:opacity-50"
            :disabled="isBidding"
            @click="placeBid"
          >
            {{ isBidding ? '出价中...' : '出价' }}
          </button>
        </div>
      </div>

      <!-- 结算（卖家）：EscrowFinish 放款给卖家 -->
      <div v-if="isEnded && isSeller && winnerBid && !auction.shipCommit" class="card">
        <h2 class="font-bold mb-4">结算</h2>
        <p class="text-sm text-gray-600 mb-2">
          赢家: {{ winnerBid.payload.bidder }} - {{ dropsToXrp(winnerBid.payload.bid_drops) }} XRP
        </p>
        <p class="text-xs text-gray-500 mb-2">拍卖结束后即可放款，输家 1 分钟后可申请退款。以链上 ledger 时间为准。</p>
        <button
          class="btn-primary disabled:opacity-50"
          :disabled="isSettling || !isPastFinishAfter"
          @click="settle"
        >
          {{ isSettling ? '结算中...' : isPastFinishAfter ? 'EscrowFinish 放款' : '请等待拍卖结束' }}
        </button>
      </div>

      <!-- 赢家自助付款：得标者可自行完成转账给卖家 -->
      <div v-if="isEnded && isWinner && winnerBid && !auction.shipCommit" class="card">
        <h2 class="font-bold mb-4">完成付款（得标者）</h2>
        <p class="text-sm text-gray-600 mb-2">
          您已得标，款项 {{ dropsToXrp(winnerBid.payload.bid_drops) }} XRP 将转给卖家。拍卖结束后即可操作（1 分钟内有效）。
        </p>
        <button
          class="btn-primary disabled:opacity-50"
          :disabled="isSettling || !isPastFinishAfter"
          @click="settle"
        >
          {{ isSettling ? '转账中...' : isPastFinishAfter ? '完成付款（EscrowFinish）' : '请等待拍卖结束' }}
        </button>
      </div>

      <!-- 输家自助退款（拍卖结束 1 分钟后） -->
      <div v-if="isEnded && canCancelMyEscrow" class="card">
        <h2 class="font-bold mb-4">申请退款</h2>
        <p class="text-sm text-gray-600 mb-2">您未中标，可在拍卖结束 1 分钟后取回锁定的款项。</p>
        <button
          class="btn-secondary disabled:opacity-50"
          :disabled="isCancelling || !isPastCancelAfter"
          @click="cancelMyEscrow"
        >
          {{ isCancelling ? '处理中...' : isPastCancelAfter ? 'EscrowCancel 退款' : '请等待 1 分钟后操作' }}
        </button>
      </div>

      <!-- 交割凭证：卖家承诺发货 -->
      <div v-if="auction.shipCommit" class="card bg-green-50">
        <h2 class="font-bold mb-2">已承诺发货</h2>
        <p class="text-sm">tracking_hash: {{ auction.shipCommit.payload.tracking_hash || '-' }}</p>
      </div>
      <div v-else-if="isEnded && isSeller && winnerBid" class="card">
        <h2 class="font-bold mb-4">承诺发货 (SHIP_COMMIT)</h2>
        <input
          v-model="trackingHash"
          class="input mb-2"
          placeholder="物流单号 (可选)"
        />
        <button
          class="btn-primary disabled:opacity-50"
          :disabled="isShipping"
          @click="shipCommit"
        >
          {{ isShipping ? '提交中...' : '提交 SHIP_COMMIT' }}
        </button>
      </div>

      <!-- 交割凭证：买家确认收货 -->
      <div v-if="auction.receivedConfirm" class="card bg-green-50">
        <h2 class="font-bold">买家已确认收货</h2>
      </div>
      <div v-else-if="auction.shipCommit && isWinner" class="card">
        <h2 class="font-bold mb-4">确认收货 (RECEIVED_CONFIRM)</h2>
        <button
          class="btn-primary disabled:opacity-50"
          :disabled="isConfirming"
          @click="receivedConfirm"
        >
          {{ isConfirming ? '提交中...' : '确认收货' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { XRP_TO_DROPS, ESCROW_RELEASE_DELAY_SEC, ESCROW_CANCEL_AFTER_GRACE_SEC, unixToRippleSeconds } from '~/lib/auction'
import type { AuctionWithBids } from '~/lib/auction'
import { getLedgerCloseTimeRipple } from '~/composables/useAuctionChain'

const route = useRoute()
const id = route.params.id as string

const { fetchAuctions } = useAuctionChain()
const {
  submitBid,
  submitEscrowFinish,
  submitEscrowCancel,
  lookupEscrowSequence,
  submitShipCommit,
  submitReceivedConfirm,
} = useAuctionTx()
const { accountInfo, isConnected, showStatus } = useWallet()

const auction = ref<AuctionWithBids | null>(null)
const loading = ref(true)
const bidXrp = ref(0)
const isBidding = ref(false)
const isSettling = ref(false)
const isCancelling = ref(false)
const isShipping = ref(false)
const isConfirming = ref(false)
const trackingHash = ref('')

const isEnded = computed(() => {
  if (!auction.value) return false
  return auction.value.auction.end_time * 1000 < Date.now()
})

const sortedBids = computed(() => {
  if (!auction.value) return []
  return [...auction.value.bids].sort(
    (a, b) => Number(b.payload.bid_drops) - Number(a.payload.bid_drops)
  )
})

const winnerBid = computed(() => sortedBids.value[0] ?? null)

const isSeller = computed(() => {
  return accountInfo.value?.address === auction.value?.auction.seller
})

const isWinner = computed(() => {
  return accountInfo.value?.address === winnerBid.value?.payload.bidder
})

const myBid = computed(() => {
  const addr = accountInfo.value?.address
  if (!addr) return null
  return auction.value?.bids.find((b) => b.payload.bidder === addr) ?? null
})

const canCancelMyEscrow = computed(() => {
  return !!myBid.value && !isWinner.value
})

const ledgerCloseTimeRipple = ref(0)
const finishAfterRipple = computed(() => {
  if (!auction.value) return 0
  return unixToRippleSeconds(auction.value.auction.end_time) + ESCROW_RELEASE_DELAY_SEC
})
const isPastFinishAfter = computed(() => {
  if (!auction.value || finishAfterRipple.value === 0) return false
  if (ledgerCloseTimeRipple.value > 0) return ledgerCloseTimeRipple.value > finishAfterRipple.value
  return Date.now() / 1000 > auction.value.auction.end_time + ESCROW_RELEASE_DELAY_SEC
})

const isPastCancelAfter = computed(() => {
  if (!auction.value) return false
  const cancelAfterTs = auction.value.auction.end_time + ESCROW_CANCEL_AFTER_GRACE_SEC
  return Date.now() / 1000 > cancelAfterTs
})

function dropsToXrp(drops: string): string {
  return (Number(drops) / XRP_TO_DROPS).toFixed(2)
}

function formatTime(ts: number): string {
  return new Date(ts * 1000).toLocaleString()
}

async function refreshLedgerTime() {
  if (auction.value && isEnded.value) {
    try {
      ledgerCloseTimeRipple.value = await getLedgerCloseTimeRipple()
    } catch {
      ledgerCloseTimeRipple.value = 0
    }
  }
}

async function loadAuction() {
  loading.value = true
  try {
    const list = await fetchAuctions()
    auction.value = list.find((a) => a.auction.auction_id === id) ?? null
    await refreshLedgerTime()
  } catch (e: any) {
    auction.value = null
    showStatus(e?.message || '加载拍卖信息失败', 'error')
  } finally {
    loading.value = false
  }
}

async function placeBid() {
  if (!auction.value || !bidXrp.value || bidXrp.value <= 0) {
    showStatus('请输入有效出价', 'error')
    return
  }
  const minInc = Number(auction.value.auction.min_increment_drops) / XRP_TO_DROPS
  const highest = sortedBids.value[0]
  const minBid = highest
    ? Number(highest.payload.bid_drops) / XRP_TO_DROPS + minInc
    : Number(auction.value.auction.reserve_drops) / XRP_TO_DROPS
  if (bidXrp.value < minBid) {
    showStatus(`出价须不低于 ${minBid.toFixed(1)} XRP`, 'error')
    return
  }
  isBidding.value = true
  try {
    await submitBid({
      auctionId: id,
      sellerAddress: auction.value.auction.seller,
      bidDrops: String(Math.round(bidXrp.value * XRP_TO_DROPS)),
      endTimeUnix: auction.value.auction.end_time,
    })
    showStatus('出价成功', 'success')
    await loadAuction()
  } catch (e: any) {
    showStatus(e?.message || '出价失败', 'error')
  } finally {
    isBidding.value = false
  }
}

async function settle() {
  if (!auction.value || !winnerBid.value) return
  isSettling.value = true
  let seq = winnerBid.value.payload.escrow_seq
  const owner = winnerBid.value.payload.escrow_owner
  const dest = auction.value.auction.seller
  const amt = winnerBid.value.payload.bid_drops
  try {
    await submitEscrowFinish(owner, seq)
    showStatus('EscrowFinish 成功，款项已释放给卖家', 'success')
    await loadAuction()
  } catch (e: any) {
    const altSeq = await lookupEscrowSequence(owner, dest, amt)
    if (altSeq != null && altSeq !== seq) {
      try {
        await submitEscrowFinish(owner, altSeq)
        showStatus('EscrowFinish 成功（已从链上校正序号），款项已释放给卖家', 'success')
        await loadAuction()
      } catch (e2: any) {
        showStatus(e2?.message || '结算失败', 'error')
      }
    } else {
      showStatus(e?.message || '结算失败', 'error')
    }
  } finally {
    isSettling.value = false
  }
}

async function cancelMyEscrow() {
  if (!myBid.value) return
  isCancelling.value = true
  try {
    await submitEscrowCancel(myBid.value.payload.escrow_owner, myBid.value.payload.escrow_seq)
    showStatus('EscrowCancel 成功，款项已退回', 'success')
    await loadAuction()
  } catch (e: any) {
    showStatus(e?.message || '退款失败', 'error')
  } finally {
    isCancelling.value = false
  }
}

async function shipCommit() {
  if (!auction.value || !winnerBid.value) return
  isShipping.value = true
  try {
    await submitShipCommit({
      type: 'SHIP_COMMIT',
      auction_id: id,
      seller: auction.value.auction.seller,
      winner: winnerBid.value.payload.bidder,
      tracking_hash: trackingHash.value || undefined,
      ts: Math.floor(Date.now() / 1000),
    })
    showStatus('SHIP_COMMIT 已上链', 'success')
    await loadAuction()
  } catch (e: any) {
    showStatus(e?.message || '提交失败', 'error')
  } finally {
    isShipping.value = false
  }
}

async function receivedConfirm() {
  if (!auction.value) return
  isConfirming.value = true
  try {
    await submitReceivedConfirm({
      type: 'RECEIVED_CONFIRM',
      auction_id: id,
      buyer: accountInfo.value!.address,
      ts: Math.floor(Date.now() / 1000),
    })
    showStatus('RECEIVED_CONFIRM 已上链', 'success')
    await loadAuction()
  } catch (e: any) {
    showStatus(e?.message || '提交失败', 'error')
  } finally {
    isConfirming.value = false
  }
}

onMounted(() => {
  loadAuction()
  const interval = setInterval(refreshLedgerTime, 5000)
  onUnmounted(() => clearInterval(interval))
})
</script>

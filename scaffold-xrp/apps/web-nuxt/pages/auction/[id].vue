<template>
  <div class="max-w-4xl mx-auto p-6">
    <div v-if="loading" class="text-center py-12">Loading...</div>
    <div v-else-if="!auction" class="text-center py-12 text-gray-500">Auction not found</div>
    <div v-else class="space-y-6">
      <div class="card">
        <h1 class="text-2xl font-bold">{{ auction.auction.title }}</h1>
        <p class="text-sm text-gray-500">ID: {{ auction.auction.auction_id }}</p>
        <p>Seller: {{ auction.auction.seller }}</p>
        <p>Details Hash: {{ auction.auction.desc_hash }}</p>
        <p>Reserve Price: {{ dropsToXrp(auction.auction.reserve_drops) }} XRP</p>
        <p>Min Increment: {{ dropsToXrp(auction.auction.min_increment_drops) }} XRP</p>
        <p>
          Time: {{ formatTime(auction.auction.start_time) }} ~ {{ formatTime(auction.auction.end_time) }}
          <span :class="isEnded ? 'text-orange-600' : 'text-green-600'">
            {{ isEnded ? '(Ended)' : '(Live)' }}
          </span>
        </p>
      </div>

      <div class="card">
        <h2 class="font-bold mb-4">Bid History</h2>
        <div class="space-y-2">
          <div
            v-for="(b, i) in sortedBids"
            :key="i"
            class="flex justify-between py-2 border-b last:border-0"
          >
            <span>{{ b.payload.bidder }} (escrow_seq: {{ b.payload.escrow_seq }})</span>
            <span class="font-mono">{{ dropsToXrp(b.payload.bid_drops) }} XRP</span>
          </div>
          <div v-if="!auction.bids.length" class="text-gray-500">No bids yet</div>
        </div>
      </div>

      <div v-if="!isEnded && isConnected" class="card">
        <h2 class="font-bold mb-4">Place Bid</h2>
        <div class="flex gap-4 items-end">
          <div class="flex-1">
            <label class="block text-sm mb-1">Bid Amount (XRP)</label>
            <input
              v-model.number="bidXrp"
              type="number"
              step="0.1"
              min="0"
              class="input"
              placeholder="e.g. 52"
            />
          </div>
          <button
            class="btn-primary disabled:opacity-50"
            :disabled="isBidding"
            @click="placeBid"
          >
            {{ isBidding ? 'Submitting...' : 'Place Bid' }}
          </button>
        </div>
      </div>

      <div v-if="isEnded && isSeller && winnerBid && !auction.shipCommit" class="card">
        <h2 class="font-bold mb-4">Settle Auction</h2>
        <p class="text-sm text-gray-600 mb-2">
          Winner: {{ winnerBid.payload.bidder }} - {{ dropsToXrp(winnerBid.payload.bid_drops) }} XRP
        </p>
        <p class="text-xs text-gray-500 mb-2">After the auction ends, release winner funds. Non-winners can request refunds after 1 minute.</p>
        <button
          class="btn-primary disabled:opacity-50"
          :disabled="isSettling || !isPastFinishAfter"
          @click="settle"
        >
          {{ isSettling ? 'Processing...' : isPastFinishAfter ? 'EscrowFinish' : 'Wait for auction end' }}
        </button>
      </div>

      <div v-if="isEnded && isWinner && winnerBid && !auction.shipCommit" class="card">
        <h2 class="font-bold mb-4">Complete Payment (Winner)</h2>
        <p class="text-sm text-gray-600 mb-2">
          You are the winning bidder. {{ dropsToXrp(winnerBid.payload.bid_drops) }} XRP will be released to the seller.
        </p>
        <button
          class="btn-primary disabled:opacity-50"
          :disabled="isSettling || !isPastFinishAfter"
          @click="settle"
        >
          {{ isSettling ? 'Processing...' : isPastFinishAfter ? 'Complete Payment (EscrowFinish)' : 'Wait for auction end' }}
        </button>
      </div>

      <div v-if="isEnded && canCancelMyEscrow" class="card">
        <h2 class="font-bold mb-4">Request Refund</h2>
        <p class="text-sm text-gray-600 mb-2">If you did not win, you can cancel escrow and recover funds 1 minute after auction end.</p>
        <button
          class="btn-secondary disabled:opacity-50"
          :disabled="isCancelling || !isPastCancelAfter"
          @click="cancelMyEscrow"
        >
          {{ isCancelling ? 'Processing...' : isPastCancelAfter ? 'EscrowCancel Refund' : 'Wait 1 minute' }}
        </button>
      </div>

      <div v-if="auction.shipCommit" class="card bg-green-50">
        <h2 class="font-bold mb-2">Shipping Confirmed</h2>
        <p class="text-sm">tracking_hash: {{ auction.shipCommit.payload.tracking_hash || '-' }}</p>
      </div>
      <div v-else-if="isEnded && isSeller && winnerBid" class="card">
        <h2 class="font-bold mb-4">Commit Shipping</h2>
        <input
          v-model="trackingHash"
          class="input mb-2"
          placeholder="Tracking number (optional)"
        />
        <button
          class="btn-primary disabled:opacity-50"
          :disabled="isShipping"
          @click="shipCommit"
        >
          {{ isShipping ? 'Submitting...' : 'Submit SHIP_COMMIT' }}
        </button>
      </div>

      <div v-if="auction.receivedConfirm" class="card bg-green-50">
        <h2 class="font-bold">Buyer Confirmed Receipt</h2>
      </div>
      <div v-else-if="auction.shipCommit && isWinner" class="card">
        <h2 class="font-bold mb-4">Confirm Receipt</h2>
        <button
          class="btn-primary disabled:opacity-50"
          :disabled="isConfirming"
          @click="receivedConfirm"
        >
          {{ isConfirming ? 'Submitting...' : 'Confirm Receipt' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { XRP_TO_DROPS, ESCROW_RELEASE_DELAY_SEC, ESCROW_CANCEL_AFTER_GRACE_SEC, unixToRippleSeconds } from '~/lib/auction'
import type { AuctionWithBids } from '~/lib/auction'
import { getLedgerCloseTimeRipple, useAuctionChain } from '~/composables/useAuctionChain'
import { useAuctionTx } from '~/composables/useAuctionTx'
import { useWallet } from '~/composables/useWallet'

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
    showStatus(e?.message || 'Failed to load auction details', 'error')
  } finally {
    loading.value = false
  }
}

async function placeBid() {
  if (!auction.value || !bidXrp.value || bidXrp.value <= 0) {
    showStatus('Please enter a valid bid amount', 'error')
    return
  }
  const minInc = Number(auction.value.auction.min_increment_drops) / XRP_TO_DROPS
  const highest = sortedBids.value[0]
  const minBid = highest
    ? Number(highest.payload.bid_drops) / XRP_TO_DROPS + minInc
    : Number(auction.value.auction.reserve_drops) / XRP_TO_DROPS
  if (bidXrp.value < minBid) {
    showStatus(`Bid must be at least ${minBid.toFixed(1)} XRP`, 'error')
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
    showStatus('Bid submitted successfully', 'success')
    await loadAuction()
  } catch (e: any) {
    showStatus(e?.message || 'Bid failed', 'error')
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
    showStatus('Settlement successful. Funds released to seller.', 'success')
    await loadAuction()
  } catch (e: any) {
    const altSeq = await lookupEscrowSequence(owner, dest, amt)
    if (altSeq != null && altSeq !== seq) {
      try {
        await submitEscrowFinish(owner, altSeq)
        showStatus('Settlement successful (sequence fixed from ledger).', 'success')
        await loadAuction()
      } catch (e2: any) {
        showStatus(e2?.message || 'Settlement failed', 'error')
      }
    } else {
      showStatus(e?.message || 'Settlement failed', 'error')
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
    showStatus('Refund successful. Funds returned to your wallet.', 'success')
    await loadAuction()
  } catch (e: any) {
    showStatus(e?.message || 'Refund failed', 'error')
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
    showStatus('SHIP_COMMIT submitted on-chain', 'success')
    await loadAuction()
  } catch (e: any) {
    showStatus(e?.message || 'Submit failed', 'error')
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
    showStatus('RECEIVED_CONFIRM submitted on-chain', 'success')
    await loadAuction()
  } catch (e: any) {
    showStatus(e?.message || 'Submit failed', 'error')
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

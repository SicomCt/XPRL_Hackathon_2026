<script setup lang="ts">
import { useWallet } from '~/composables/useWallet'

const WALLET_LINKS: Record<string, string> = {
  crossmark: 'https://crossmark.com',
  gemwallet: 'https://gemwallet.com',
}

const { walletManager, isConnected, accountInfo, showStatus } = useWallet()
const isConnecting = ref(false)
const showDropdown = ref(false)
const walletAvailability = ref<Record<string, boolean>>({})
const gemwalletChecking = ref(false)

async function checkAdapter(adapter: any): Promise<boolean> {
  try {
    return !!(await adapter?.isAvailable?.())
  } catch {
    return false
  }
}

async function checkAvailability() {
  if (!walletManager.value) return
  const adapters = (walletManager.value as any).adapters
  if (!adapters) return
  const result: Record<string, boolean> = {}

  for (const [id, adapter] of adapters) {
    result[id] = await checkAdapter(adapter)
  }
  // GemWallet content-script injection can be slow; retry after delay.
  if (result.gemwallet === false && adapters.has('gemwallet')) {
    await new Promise(r => setTimeout(r, 800))
    result.gemwallet = await checkAdapter(adapters.get('gemwallet'))
  }
  walletAvailability.value = result
}

async function retryGemwalletCheck() {
  if (!walletManager.value?.adapters?.has?.('gemwallet')) return
  gemwalletChecking.value = true
  try {
    const ok = await checkAdapter(walletManager.value.adapters.get('gemwallet'))
    walletAvailability.value = { ...walletAvailability.value, gemwallet: ok }
    if (ok) showStatus('GemWallet detected', 'success')
  } finally {
    gemwalletChecking.value = false
  }
}

function toggleDropdown() {
  if (walletManager.value && !isConnecting.value) {
    showDropdown.value = !showDropdown.value
    if (showDropdown.value) checkAvailability()
  }
}

async function ensureGemwalletAvailable(): Promise<boolean> {
  const adapter = walletManager.value?.adapters?.get?.('gemwallet')
  if (!adapter) return false
  for (let i = 0; i < 4; i++) {
    if (await checkAdapter(adapter)) return true
    if (i < 3) await new Promise(r => setTimeout(r, 600))
  }
  return false
}

async function connect(walletId: 'crossmark' | 'gemwallet') {
  if (!walletManager.value) {
    showStatus('Wallet loading, please wait...', 'info')
    return
  }
  if (walletManager.value.connected) return
  try {
    isConnecting.value = true
    showDropdown.value = false
    showStatus(`Connecting to ${walletId === 'crossmark' ? 'Crossmark' : 'GemWallet'}...`, 'info')
    // GemWallet detection can be flaky; retry before connecting.
    if (walletId === 'gemwallet') {
      const ok = await ensureGemwalletAvailable()
      if (!ok) {
        showStatus('GemWallet not responding. Try: refresh page, use Chrome/Edge, or open GemWallet popup first.', 'error')
        return
      }
    }
    await walletManager.value.connect(walletId)
    showStatus('Connected!', 'success')
  } catch (e: any) {
    const msg = e?.message || ''
    const isNotAvailable = msg.includes('not currently available') || msg.includes('not available')
    const walletName = walletId === 'crossmark' ? 'Crossmark' : 'GemWallet'
    const installUrl = WALLET_LINKS[walletId]
    if (isNotAvailable && installUrl) {
      showStatus(`${walletName} not installed. Please install: ${installUrl}`, 'error')
    } else {
      showStatus(msg || 'Connection failed', 'error')
    }
  } finally {
    isConnecting.value = false
  }
}

async function disconnect() {
  try {
    await walletManager.value?.disconnect()
    showStatus('Disconnected', 'info')
  } catch (e: any) {
    showStatus(e?.message || 'Disconnect failed', 'error')
  }
}

// Close dropdown when clicking outside.
function handleClickOutside(e: MouseEvent) {
  const target = e.target as HTMLElement
  if (!target.closest('.wallet-connector-wrap')) {
    showDropdown.value = false
  }
}
onMounted(() => document.addEventListener('click', handleClickOutside))
onUnmounted(() => document.removeEventListener('click', handleClickOutside))
</script>

<template>
  <div class="wallet-connector-wrap relative flex items-center gap-2">
    <!-- Connected state: show address and disconnect -->
    <template v-if="isConnected && accountInfo?.walletName !== 'Manual'">
      <span class="text-sm text-gray-600 truncate max-w-[140px]">
        {{ accountInfo?.address?.slice(0, 6) }}...{{ accountInfo?.address?.slice(-4) }}
      </span>
      <button
        type="button"
        class="px-3 py-1.5 text-xs rounded-lg transition-colors border border-rose-400/40 bg-rose-500/20 text-rose-100 hover:bg-rose-500/30"
        @click="disconnect"
      >
        Disconnect
      </button>
    </template>
    <!-- Disconnected state: connect button + wallet dropdown -->
    <template v-else>
      <template v-if="walletManager">
        <button
          type="button"
          class="px-4 py-2 text-white text-sm font-medium rounded-lg transition-all duration-200 disabled:opacity-50 flex items-center gap-1 bg-gradient-to-r from-cyan-500 to-indigo-500 hover:from-cyan-400 hover:to-violet-500 shadow-[0_6px_20px_rgba(59,130,246,0.35)]"
          :disabled="isConnecting"
          @click="toggleDropdown"
        >
          {{ isConnecting ? 'Connecting...' : 'Connect Wallet' }}
          <span v-if="!isConnecting" class="text-xs">▼</span>
        </button>
        <div
          v-if="showDropdown"
          class="absolute right-0 top-full mt-1 w-56 py-1 bg-white border rounded-lg shadow-lg z-50"
        >
          <button
            type="button"
            class="w-full px-4 py-2.5 text-left text-sm hover:bg-gray-100 flex items-center justify-between gap-2"
            :class="{ 'opacity-60': walletAvailability.crossmark === false }"
            :disabled="walletAvailability.crossmark === false"
            @click="connect('crossmark')"
          >
            <span>Crossmark</span>
            <span v-if="walletAvailability.crossmark === false" class="text-xs text-gray-400">Not installed</span>
          </button>
          <button
            type="button"
            class="w-full px-4 py-2.5 text-left text-sm hover:bg-gray-100 flex items-center justify-between gap-2"
            :class="{ 'opacity-60': walletAvailability.gemwallet === false || gemwalletChecking }"
            :disabled="walletAvailability.gemwallet === false || gemwalletChecking"
            @click="connect('gemwallet')"
          >
            <span>GemWallet</span>
            <span v-if="gemwalletChecking" class="text-xs text-blue-500">Checking...</span>
            <span v-else-if="walletAvailability.gemwallet === false" class="text-xs text-gray-400 flex items-center gap-1">
              Not detected
              <button
                type="button"
                class="text-blue-500 hover:underline"
                @click.stop="retryGemwalletCheck()"
              >
                Retry
              </button>
            </span>
          </button>
          <div class="border-t mt-1 pt-1 px-4 py-2">
            <p class="text-xs text-gray-500">Don't have a wallet?</p>
            <a
              href="https://crossmark.com"
              target="_blank"
              rel="noopener"
              class="text-xs text-blue-600 hover:underline"
            >
              Install Crossmark
            </a>
            <span class="text-gray-400 mx-1">|</span>
            <a
              href="https://gemwallet.com"
              target="_blank"
              rel="noopener"
              class="text-xs text-blue-600 hover:underline"
            >
              Install GemWallet
            </a>
          </div>
        </div>
      </template>
      <span v-else class="text-sm text-gray-500 px-3 py-2">Loading wallets...</span>
    </template>
  </div>
</template>

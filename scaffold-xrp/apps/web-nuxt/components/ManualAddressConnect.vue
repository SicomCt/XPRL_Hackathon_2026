<script setup lang="ts">
const { isConnected, accountInfo, setManualAddress, clearManualConnection, showStatus } = useWallet()
const showInput = ref(false)
const addressInput = ref('')

function handleSubmit() {
  const addr = addressInput.value?.trim()
  if (!addr) {
    showStatus('Please enter an address', 'error')
    return
  }
  if (!/^r[1-9A-HJ-NP-Za-km-z]{24,34}$/.test(addr)) {
    showStatus('Invalid XRPL address format', 'error')
    return
  }
  setManualAddress(addr)
  showInput.value = false
  addressInput.value = ''
  showStatus('Address added (read-only)', 'success')
}

function handleDisconnect() {
  clearManualConnection()
  showInput.value = false
}
</script>

<template>
  <div class="relative">
    <button
      v-if="!isConnected || accountInfo?.walletName !== 'Manual'"
      type="button"
      class="px-4 py-2 text-white text-sm font-medium rounded-lg transition-all duration-200 bg-gradient-to-r from-sky-500 to-indigo-500 hover:from-sky-400 hover:to-violet-500 shadow-[0_6px_20px_rgba(59,130,246,0.35)]"
      @click="showInput = !showInput"
    >
      Manual Address
    </button>
    <div
      v-else
      class="flex items-center gap-2 px-3 py-2 bg-gray-100 rounded-lg text-sm"
    >
      <span class="text-gray-600 truncate max-w-[120px]">{{ accountInfo?.address }}</span>
      <button
        type="button"
        class="text-rose-200 hover:text-rose-100 text-xs"
        @click="handleDisconnect"
      >
        Disconnect
      </button>
    </div>

    <div
      v-if="showInput"
      class="absolute right-0 top-full mt-2 w-80 p-3 bg-white border rounded-lg shadow-lg z-50"
    >
      <p class="text-xs text-gray-500 mb-2">Enter XRPL address (read-only, no signing)</p>
      <input
        v-model="addressInput"
        type="text"
        placeholder="rN7n7otQDd6FczFgLdlqtyMVrn3HMfXoQT"
        class="w-full px-3 py-2 border rounded text-sm mb-2"
        @keyup.enter="handleSubmit"
      />
      <div class="flex gap-2">
        <button
          type="button"
          class="flex-1 px-3 py-1.5 bg-gray-900 text-white text-sm rounded hover:bg-gray-800"
          @click="handleSubmit"
        >
          Connect
        </button>
        <button
          type="button"
          class="px-3 py-1.5 border rounded text-sm hover:bg-gray-50"
          @click="showInput = false"
        >
          Cancel
        </button>
      </div>
    </div>
  </div>
</template>

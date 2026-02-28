<script setup lang="ts">
const { statusMessage } = useWallet()

const statusClass = computed(() => {
  if (!statusMessage.value) return ''
  const type = statusMessage.value.type
  if (type === 'success') return 'bg-green-50 text-green-700'
  if (type === 'error') return 'bg-red-50 text-red-700'
  if (type === 'warning') return 'bg-yellow-50 text-yellow-700'
  return 'bg-blue-50 text-blue-700'
})
</script>

<template>
  <header class="bg-white border-b border-gray-200">
    <div class="container mx-auto px-4 py-4">
      <div class="flex items-center justify-between">
        <div class="flex items-center space-x-4">
          <NuxtLink to="/" class="flex items-center space-x-2 hover:opacity-80">
            <div class="w-10 h-10 bg-xrpl rounded-lg flex items-center justify-center">
              <span class="text-white font-bold text-xl">X</span>
            </div>
            <span class="text-xl font-bold">Scaffold-XRP</span>
          </NuxtLink>
          <nav class="flex gap-2 text-sm">
            <NuxtLink
              to="/create"
              class="px-4 py-2 bg-gray-900 hover:bg-gray-800 text-white font-medium rounded-lg transition-colors"
            >
              Create Auction
            </NuxtLink>
            <NuxtLink
              to="/me"
              class="px-4 py-2 bg-gray-900 hover:bg-gray-800 text-white font-medium rounded-lg transition-colors"
            >
              My Bids
            </NuxtLink>
          </nav>
        </div>

        <div class="flex items-center space-x-4">
          <div
            v-if="statusMessage"
            :class="['text-sm px-3 py-1 rounded-lg', statusClass]"
          >
            {{ statusMessage.message }}
          </div>
          <div class="flex items-center gap-2">
          <ManualAddressConnect />
          <ClientOnly fallback-tag="div" fallback="">
            <WalletConnector />
          </ClientOnly>
        </div>
        </div>
      </div>
    </div>
  </header>
</template>

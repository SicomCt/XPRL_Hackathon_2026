<script setup lang="ts">
import { useWallet } from '~/composables/useWallet'

const { statusMessage } = useWallet()

const statusClass = computed(() => {
  if (!statusMessage.value) return ''
  const type = statusMessage.value.type
  if (type === 'success') return 'bg-emerald-500/20 text-emerald-200 border border-emerald-400/35'
  if (type === 'error') return 'bg-rose-500/20 text-rose-200 border border-rose-400/35'
  if (type === 'warning') return 'bg-amber-500/20 text-amber-200 border border-amber-400/35'
  return 'bg-sky-500/20 text-sky-200 border border-sky-400/35'
})
</script>

<template>
  <header class="sticky top-0 z-40 backdrop-blur-md bg-slate-950/65 border-b border-cyan-400/20">
    <div class="container mx-auto px-4 py-4">
      <div class="flex items-center justify-between">
        <div class="flex items-center space-x-4">
          <NuxtLink to="/" class="flex items-center space-x-2 hover:opacity-80">
            <div class="w-10 h-10 rounded-lg flex items-center justify-center bg-gradient-to-br from-cyan-400 to-indigo-500 shadow-[0_0_20px_rgba(56,189,248,0.45)]">
              <span class="text-white font-bold text-xl drop-shadow">X</span>
            </div>
            <span class="text-xl font-bold tech-title">Scaffold-XRP</span>
          </NuxtLink>
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

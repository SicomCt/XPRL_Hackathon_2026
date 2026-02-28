<script setup lang="ts">
const mounted = ref(false)

onMounted(() => {
  mounted.value = true
})
</script>

<template>
  <div class="tech-theme min-h-screen">
    <div v-if="!mounted" class="flex items-center justify-center min-h-screen">
      <div class="text-center">
        <div class="inline-block w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
        <p class="mt-3 text-gray-300">Loading...</p>
      </div>
    </div>
    <NuxtLayout v-else>
      <NuxtPage />
    </NuxtLayout>
  </div>
</template>

<script setup lang="ts">
const mounted = ref(false)

onMounted(() => {
  mounted.value = true
})
</script>

<template>
  <div class="bg-gray-50 min-h-screen">
    <!-- 首屏占位 -->
    <div v-if="!mounted" class="flex items-center justify-center min-h-screen">
      <div class="text-center">
        <div class="inline-block w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        <p class="mt-3 text-gray-600">加载中...</p>
      </div>
    </div>
    <NuxtLayout v-else>
      <NuxtPage />
    </NuxtLayout>
  </div>
</template>

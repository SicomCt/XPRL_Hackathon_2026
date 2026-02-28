<template>
  <div class="max-w-3xl mx-auto p-6 space-y-6">
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-bold">Create Auction</h1>
    </div>

    <div class="grid gap-4">
      <div>
        <label class="text-sm">Title</label>
        <input v-model="form.title" class="mt-1 w-full border rounded p-2" />
      </div>

      <div>
        <label class="text-sm">Description</label>
        <textarea v-model="form.description" class="mt-1 w-full border rounded p-2" rows="4" />
      </div>

      <div class="grid grid-cols-2 gap-4">
        <div>
          <label class="text-sm">Start Price (XRP)</label>
          <input v-model="form.startPriceXrp" class="mt-1 w-full border rounded p-2" />
        </div>
        <div>
          <label class="text-sm">Min Increment (XRP)</label>
          <input v-model="form.minIncrementXrp" class="mt-1 w-full border rounded p-2" />
        </div>
      </div>

      <div class="grid grid-cols-2 gap-4">
        <div>
          <label class="text-sm">End Time</label>
          <input v-model="form.endTime" type="datetime-local" class="mt-1 w-full border rounded p-2" />
        </div>
        <div>
          <label class="text-sm">Photo (for now: URL)</label>
          <input v-model="form.photoUrl" class="mt-1 w-full border rounded p-2" />
        </div>
      </div>

      <button class="border rounded px-4 py-2 w-fit" @click="mockPublish">
        Publish (mock)
      </button>

      <pre class="text-xs bg-gray-50 border rounded p-3 overflow-auto">{{ preview }}</pre>
    </div>
  </div>
</template>

<script setup lang="ts">
const form = reactive({
  title: "",
  description: "",
  photoUrl: "",
  startPriceXrp: "10",
  minIncrementXrp: "1",
  endTime: "",
})

const preview = computed(() => ({
  ...form,
  note: "下一步：photo+metadata 上传 web3.storage，拿到 metaCID 后再做 AUCTION_CREATE 上链锚点",
}))

function mockPublish() {
  alert("Create page OK ✅ 下一步接 web3.storage + AUCTION_CREATE")
}
</script>
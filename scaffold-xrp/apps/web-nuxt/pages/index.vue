<script setup lang="ts">
useHead({
  title: '链上拍卖 - XRPL Memo + Escrow',
})
</script>

<template>
  <div class="min-h-screen">
    <main class="container mx-auto px-4 py-8">
      <div class="mb-8">
        <h1 class="text-4xl font-bold mb-2">链上拍卖</h1>
        <p class="text-gray-600">
          基于 XRPL Memo 事件流 + Escrow 锁款的普通商品拍卖
        </p>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <AccountInfo />
      </div>

      <div class="mb-8 grid grid-cols-1 md:grid-cols-2 gap-4">
        <NuxtLink
          to="/auctions"
          class="card hover:shadow-lg transition-shadow block"
        >
          <h2 class="text-xl font-bold mb-2">拍品池</h2>
          <p class="text-sm text-gray-600">查看链上拍品与出价</p>
        </NuxtLink>
        <NuxtLink
          to="/create"
          class="card hover:shadow-lg transition-shadow block"
        >
          <h2 class="text-xl font-bold mb-2">发布拍品</h2>
          <p class="text-sm text-gray-600">AUCTION_CREATE 上链</p>
        </NuxtLink>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <ContractInteraction />
        <TransactionForm />
      </div>

      <div class="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h2 class="text-xl font-bold mb-3">功能说明</h2>
        <div class="space-y-2 text-sm">
          <p>1. <b>AUCTION_CREATE</b>：卖家发 0 XRP Payment + Memo 到 AuctionIndex</p>
          <p>2. <b>BID</b>：EscrowCreate 锁款 + BID Memo 上链</p>
          <p>3. <b>结算</b>：EscrowFinish（赢家放款）、EscrowCancel（输家退款）</p>
          <p>4. <b>交割凭证</b>：SHIP_COMMIT、RECEIVED_CONFIRM 上链</p>
        </div>
      </div>
    </main>

    <footer class="border-t border-gray-200 mt-16">
      <div class="container mx-auto px-4 py-6 text-center text-gray-600">
        <p>Built with Scaffold-XRP · 链上拍卖 MVP</p>
      </div>
    </footer>
  </div>
</template>

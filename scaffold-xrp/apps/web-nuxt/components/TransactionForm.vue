<script setup lang="ts">
const { walletManager, isConnected, addEvent, showStatus } = useWallet()

const destination = ref('')
const amount = ref('')
const result = ref<{
  success: boolean
  hash?: string
  id?: string
  error?: string
} | null>(null)
const isLoading = ref(false)

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (error && typeof error === 'object' && 'message' in error) return String((error as { message: unknown }).message)
  return String(error ?? 'Unknown error')
}

const handleSubmit = async () => {
  if (!walletManager.value || !walletManager.value.account) {
    showStatus('Please connect a wallet first', 'error')
    return
  }

  const dest = destination.value?.trim()
  const amt = String(amount.value || '').trim()
  if (!dest || !amt) {
    showStatus('Please enter destination and amount', 'error')
    return
  }
  const amtNum = Number(amt)
  if (!Number.isInteger(amtNum) || amtNum < 1) {
    showStatus('Amount must be a positive integer (drops)', 'error')
    return
  }

  try {
    isLoading.value = true
    result.value = null

    // GemWallet expects Amount as a string and requires Fee. xrpl-connect passes Account.
    const transaction = {
      TransactionType: 'Payment' as const,
      Account: walletManager.value.account.address,
      Destination: dest,
      Amount: amt, // drops as string
      Fee: '12', // minimum fee to avoid GemWallet validation issues
    }

    const txResult = await walletManager.value.signAndSubmit(transaction as any)

    result.value = {
      success: true,
      hash: txResult.hash || 'Pending',
      id: txResult.id,
    }

    showStatus('Transaction submitted successfully!', 'success')
    addEvent('Transaction Submitted', txResult)

    // Clear form
    destination.value = ''
    amount.value = ''
  } catch (error: unknown) {
    const msg = getErrorMessage(error)
    result.value = {
      success: false,
      error: msg,
    }
    showStatus(`Transaction failed: ${msg}`, 'error')
    addEvent('Transaction Failed', error)
  } finally {
    isLoading.value = false
  }
}

function clearResult() {
  result.value = null
}
</script>

<template>
  <div v-if="isConnected" class="card">
    <h2 class="text-xl font-bold mb-4">Send Transaction</h2>
    <form @submit.prevent="handleSubmit" class="space-y-4">
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-2">
          Destination Address
        </label>
        <input
          v-model="destination"
          type="text"
          placeholder="rN7n7otQDd6FczFgLdlqtyMVrn3HMfXoQT"
          class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-accent focus:border-transparent"
          required
        />
      </div>
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-2">
          Amount (drops)
        </label>
        <input
          v-model="amount"
          type="number"
          placeholder="1000000"
          min="1"
          class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-accent focus:border-transparent"
          required
        />
        <small class="text-xs text-gray-500 mt-1 block">
          1 XRP = 1,000,000 drops
        </small>
      </div>
      <button
        type="submit"
        :disabled="isLoading"
        class="w-full bg-accent text-white py-2 px-4 rounded-lg font-semibold hover:bg-accent/90 disabled:bg-gray-400 disabled:cursor-not-allowed"
      >
        {{ isLoading ? 'Signing & Submitting...' : 'Sign & Submit Transaction' }}
      </button>
    </form>

    <div
      v-if="result"
      :class="[
        'mt-4 p-4 rounded-lg',
        result.success
          ? 'bg-green-50 border border-green-200'
          : 'bg-red-50 border border-red-200'
      ]"
    >
      <template v-if="result.success">
        <h3 class="font-bold text-green-800 mb-2">Transaction Submitted!</h3>
        <p class="text-sm text-green-700">
          <strong>Hash:</strong> {{ result.hash }}
        </p>
        <p v-if="result.id" class="text-sm text-green-700">
          <strong>ID:</strong> {{ result.id }}
        </p>
        <p class="text-xs text-green-600 mt-2">
          Transaction has been signed and submitted to the ledger
        </p>
      </template>
      <template v-else>
        <h3 class="font-bold text-red-800 mb-2">Transaction Failed</h3>
        <p class="text-sm text-red-700">{{ result.error }}</p>
        <p class="text-xs text-red-600 mt-2">
          Make sure GemWallet is on <strong>Testnet</strong> (same as this app). Click "Try again" to retry.
        </p>
        <button
          type="button"
          class="mt-3 px-3 py-1.5 text-sm bg-red-100 hover:bg-red-200 text-red-800 rounded transition-colors"
          @click="clearResult"
        >
          Dismiss & Try again
        </button>
      </template>
    </div>
  </div>
</template>

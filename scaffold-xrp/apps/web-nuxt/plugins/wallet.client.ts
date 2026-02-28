import { useWallet } from '~/composables/useWallet'

export default defineNuxtPlugin(async () => {
  const { setWalletManager, setIsConnected, setAccountInfo, addEvent, showStatus } = useWallet()

  const updateConnectionState = (manager: any) => {
    setIsConnected(manager.connected)
    if (manager.connected) {
      const account = manager.account
      const wallet = manager.wallet
      if (account && wallet) {
        setAccountInfo({
          address: account.address,
          network: `${account.network.name} (${account.network.id})`,
          walletName: wallet.name,
        })
      }
    } else {
      setAccountInfo(null)
    }
  }

  try {
    const { WalletManager, CrossmarkAdapter, GemWalletAdapter } = await import('xrpl-connect')

    const manager = new WalletManager({
      adapters: [new CrossmarkAdapter(), new GemWalletAdapter()],
      network: 'testnet',
      autoConnect: true,
      logger: { level: 'info' },
    })

    manager.on('connect', (account: any) => {
      addEvent('Connected', account)
      updateConnectionState(manager)
    })
    manager.on('disconnect', () => {
      addEvent('Disconnected', null)
      updateConnectionState(manager)
    })
    manager.on('error', (error: any) => {
      addEvent('Error', error)
      showStatus(error.message, 'error')
    })

    setWalletManager(manager)

    if (!manager.connected) {
      showStatus('Please connect a wallet to get started', 'info')
    } else {
      showStatus('Wallet reconnected from previous session', 'success')
      updateConnectionState(manager)
    }

    console.log('[Wallet] Initialized', manager)
  } catch (error) {
    console.error('[Wallet] Init failed:', error)
    showStatus('Failed to initialize wallet', 'error')
  }
})

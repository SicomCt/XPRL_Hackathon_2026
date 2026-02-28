// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2024-11-01',
  devtools: { enabled: false },

  devServer: {
    port: 3000,
    host: '127.0.0.1',
  },

  modules: ['@nuxtjs/tailwindcss'],

  css: ['~/assets/css/main.css'],

  runtimeConfig: {
    public: {
      /** XRPL address that receives escrowed bids (platform/seller). Set in .env as NUXT_PUBLIC_PLATFORM_ESCROW_ADDRESS */
      platformEscrowAddress: process.env.NUXT_PUBLIC_PLATFORM_ESCROW_ADDRESS || 'rPlatformEscrowXXXXXXXXXXXXXXXXXXXXXXXXXX',
    },
  },
  app: {
    head: {
      title: 'Scaffold-XRP',
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'description', content: 'A starter kit for building dApps on XRPL with smart contracts' },
      ],
    },
  },

  // Vite configuration for polyfills (similar to next.config.js webpack config)
  vite: {
    resolve: {
      alias: {
        buffer: 'buffer/',
        events: 'events/',
        stream: 'stream-browserify',
      },
    },
    define: {
      'process.env': {},
      global: 'globalThis',
    },
    optimizeDeps: {
      include: ['buffer', 'events', 'process'],
      esbuildOptions: {
        define: {
          global: 'globalThis',
        },
      },
    },
    build: {
      commonjsOptions: {
        transformMixedEsModules: true,
      },
    },
  },

  // Run on client side only for wallet components
  ssr: false,

  typescript: {
    strict: true,
  },
})

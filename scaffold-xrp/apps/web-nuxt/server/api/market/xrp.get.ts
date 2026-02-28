export default defineEventHandler(async () => {
  const days = 180
  try {
    // 1) XRP/USD daily history from Binance (XRPUSDT close price).
    const klines = await $fetch<Array<[number, string, string, string, string]>>(
      'https://api.binance.com/api/v3/klines',
      {
        query: { symbol: 'XRPUSDT', interval: '1d', limit: days },
      }
    )

    // 2) Current FX rates to derive AUD/CNY series from USD.
    const fx = await $fetch<{ rates?: { AUD?: number; CNY?: number } }>(
      'https://api.frankfurter.app/latest',
      {
        query: { from: 'USD', to: 'AUD,CNY' },
      }
    )

    const audRate = fx?.rates?.AUD
    const cnyRate = fx?.rates?.CNY
    if (!Array.isArray(klines) || !klines.length || typeof audRate !== 'number' || typeof cnyRate !== 'number') {
      throw new Error('Invalid market response')
    }

    const points = klines
      .map(([openTime, _open, _high, _low, close]) => {
        const usd = Number(close)
        return {
          ts: openTime,
          usd,
          aud: usd * audRate,
          cny: usd * cnyRate,
        }
      })
      .filter((p) => Number.isFinite(p.usd))
      .sort((a, b) => a.ts - b.ts)

    if (!points.length) {
      throw new Error('No historical points')
    }

    return {
      rangeDays: days,
      points,
    }
  } catch {
    // Fallback: use latest XRPUSD ticker and static FX multipliers.
    const ticker = await $fetch<{ price?: string }>('https://api.binance.com/api/v3/ticker/price', {
      query: { symbol: 'XRPUSDT' },
    })
    const usd = Number(ticker?.price)
    if (!Number.isFinite(usd)) {
      throw createError({
        statusCode: 502,
        statusMessage: 'Unable to load XRP market data',
      })
    }

    // Conservative fallback multipliers so UI keeps working under FX API failures.
    const audRate = 1.53
    const cnyRate = 7.20
    const now = Date.now()
    const points = Array.from({ length: days }, (_, i) => {
      const ts = now - (days - 1 - i) * 24 * 60 * 60 * 1000
      return {
        ts,
        usd,
        aud: usd * audRate,
        cny: usd * cnyRate,
      }
    })

    return {
      rangeDays: days,
      points,
    }
  }
})

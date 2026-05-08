export interface LlamaPool {
  pool: string        // unique pool id
  chain: string
  project: string
  symbol: string
  tvlUsd: number
  apyBase?: number
  apyReward?: number
  apy?: number
}

export interface LlamaPoolResolved {
  id: string
  chain: string
  project: string
  symbol: string
  tvlUsd: number
  apr: number         // apyBase + apyReward, or apy, in %
}

export interface HistoricalPoint {
  timestamp: string
  tvlUsd: number
  apy?: number
  apyBase?: number
}

const POOLS_URL = 'https://yields.llama.fi/pools'
const CHART_URL = (id: string) => `https://yields.llama.fi/chart/${id}`
const TVL_THRESHOLD = 1_000_000

let poolsCache: LlamaPoolResolved[] | null = null
let poolsLoadPromise: Promise<LlamaPoolResolved[]> | null = null

export async function fetchPools(): Promise<LlamaPoolResolved[]> {
  if (poolsCache) return poolsCache
  if (poolsLoadPromise) return poolsLoadPromise

  poolsLoadPromise = (async () => {
    const res = await fetch(POOLS_URL)
    if (!res.ok) throw new Error(`DeFiLlama pools fetch failed: ${res.status}`)
    const json = await res.json() as { data: LlamaPool[] }

    const filtered = json.data
      .filter((p) => p.tvlUsd >= TVL_THRESHOLD)
      .map((p): LlamaPoolResolved => ({
        id: p.pool,
        chain: p.chain,
        project: p.project,
        symbol: p.symbol,
        tvlUsd: p.tvlUsd,
        apr: Math.round(((p.apyBase ?? 0) + (p.apyReward ?? 0) || (p.apy ?? 0)) * 10) / 10,
      }))
      .sort((a, b) => b.tvlUsd - a.tvlUsd)

    poolsCache = filtered
    return filtered
  })()

  return poolsLoadPromise
}

export function searchPools(pools: LlamaPoolResolved[], query: string, limit = 20): LlamaPoolResolved[] {
  const q = query.toLowerCase().trim()
  if (!q) return []
  return pools
    .filter((p) =>
      p.symbol.toLowerCase().includes(q) ||
      p.project.toLowerCase().includes(q) ||
      p.chain.toLowerCase().includes(q)
    )
    .slice(0, limit)
}

/**
 * Fetch 30 days of historical APY data for a pool and compute volatility
 * as the coefficient of variation of daily APY values (stddev / mean).
 * Returns a value in [0, 1] suitable for the poolToPD() mapping.
 */
export async function fetchVolatility(poolId: string): Promise<number> {
  const res = await fetch(CHART_URL(poolId))
  if (!res.ok) return 0.3   // fallback: moderate
  const json = await res.json() as { data: HistoricalPoint[] }

  const points = json.data.slice(-30)
  const apys = points.map((p) => p.apyBase ?? p.apy ?? 0).filter((v) => v > 0)
  if (apys.length < 3) return 0.3

  const mean = apys.reduce((s, v) => s + v, 0) / apys.length
  if (mean === 0) return 0.3

  const variance = apys.reduce((s, v) => s + (v - mean) ** 2, 0) / apys.length
  const cv = Math.sqrt(variance) / mean

  // Clamp CV to [0.02, 0.95] to stay within the poolToPD() range
  return Math.min(0.95, Math.max(0.02, Math.round(cv * 100) / 100))
}

export function formatTvl(tvl: number): string {
  if (tvl >= 1e9) return `$${(tvl / 1e9).toFixed(1)}B`
  if (tvl >= 1e6) return `$${(tvl / 1e6).toFixed(0)}M`
  return `$${(tvl / 1e3).toFixed(0)}K`
}

import { PDPayoffs } from './pd'

export interface PoolStats {
  apr: number        // annual yield in % (e.g. 12 = 12%)
  volatility: number // price volatility 0–1 (e.g. 0.3 = moderate)
  whaleShare: number // fraction of TVL held by top LPs 0–1 (e.g. 0.6 = whale-dominated)
  horizon: number    // investment horizon in days (e.g. 30, 90, 365)
}

export interface PoolPreset {
  id: string
  name: string
  description: string
  stats: PoolStats
}

export const POOL_PRESETS: PoolPreset[] = [
  {
    id: 'stable-stable',
    name: 'USDC/USDT Stablecoin',
    description: 'Low-volatility, reliable yield. Very little reason to exit. Classic cooperation scenario.',
    stats: { apr: 4, volatility: 0.05, whaleShare: 0.2, horizon: 365 },
  },
  {
    id: 'eth-usdc',
    name: 'ETH/USDC Blue Chip',
    description: 'Moderate volatility and decent yield. Whales can move the needle if they exit.',
    stats: { apr: 12, volatility: 0.35, whaleShare: 0.45, horizon: 90 },
  },
  {
    id: 'volatile-farm',
    name: 'High-Yield Farm',
    description: 'Juicy APR but high volatility and whale concentration. Classic exit-or-be-suckered setup.',
    stats: { apr: 80, volatility: 0.75, whaleShare: 0.7, horizon: 30 },
  },
  {
    id: 'new-pool',
    name: 'New Pool Launch',
    description: 'Bootstrapping liquidity with incentives. Short horizon and whale risk make the dilemma acute.',
    stats: { apr: 150, volatility: 0.6, whaleShare: 0.8, horizon: 14 },
  },
  {
    id: 'mature-pool',
    name: 'Mature DEX Pool',
    description: 'Well-established pool, diverse LPs, low volatility. Cooperation is the rational choice.',
    stats: { apr: 8, volatility: 0.2, whaleShare: 0.25, horizon: 180 },
  },
]

/**
 * Maps pool statistics to Prisoner's Dilemma payoffs (T, R, P, S).
 *
 * Design thesis:
 *  - R (mutual stay) scales with APR and horizon — the longer you stay together, the more you earn.
 *  - T (exit while others stay) is slightly above R — you avoid future IL risk while still having
 *    captured past fees. The temptation premium grows with volatility.
 *  - P (everyone exits) is penalised by slippage and lost fees — worse with whale concentration
 *    since large exits move price more.
 *  - S (stay while others exit) is the worst case — you're stuck in a draining pool with
 *    impermanent loss and no counterparty depth.
 */
export function poolToPD(stats: PoolStats): PDPayoffs {
  const { apr, volatility, whaleShare, horizon } = stats

  // Base reward for mutual cooperation: APR scaled to horizon
  const baseReward = (apr / 100) * (horizon / 365) * 10

  // R: both stay — earn the yield, modest IL from normal vol
  const ilPenalty = volatility * 0.4
  const R = round(baseReward * (1 - ilPenalty))

  // T: you exit while others stay — dodge future IL but miss some upside
  // Temptation premium is higher when volatility is high (avoiding IL matters more)
  const temptationPremium = 1 + volatility * 0.5
  const T = round(R * temptationPremium)

  // P: everyone exits — slippage + lost fees, amplified by whale concentration
  // Whales moving together crater the pool price
  const panicPenalty = 0.4 + whaleShare * 0.4
  const P = round(R * (1 - panicPenalty))

  // S: you stay while others exit — worst outcome, stuck in drained pool
  // IL + no fees + poor execution if you eventually exit
  const suckerPenalty = 0.6 + volatility * 0.3 + whaleShare * 0.2
  const S = round(R * (1 - suckerPenalty))

  // Enforce ordering: if the math produces a degenerate case, nudge gently
  return enforcePDOrdering({ T, R, P, S })
}

function round(n: number): number {
  return Math.round(n * 100) / 100
}

function enforcePDOrdering(p: PDPayoffs): PDPayoffs {
  let { T, R, P, S } = p
  // Ensure T > R
  if (T <= R) T = round(R + 0.5)
  // Ensure R > P
  if (P >= R) P = round(R - 0.5)
  // Ensure P > S
  if (S >= P) S = round(P - 0.5)
  // Ensure 2R > T + S (cooperation beats average of extremes)
  if (2 * R <= T + S) S = round(2 * R - T - 0.01)
  return { T, R, P, S }
}

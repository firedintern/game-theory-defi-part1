/**
 * Mechanism Design engine.
 *
 * Models how real DeFi protocol mechanisms (exit fees, lockups, vesting penalties)
 * shift the Prisoner's Dilemma payoff matrix and change the Nash equilibrium.
 *
 * All default values sourced from live protocols (2024-2025):
 *   - Exit fee range 0–0.8%: GMX GLP rebalancing fee (gmxio.gitbook.io/gmx/glp)
 *   - Lockup range 0–208 weeks: Curve veCRV max 4 years, Convex vlCVX 16 weeks
 *   - Vesting penalty range 0–50%: Camelot xGRAIL (15-day vest = 50% penalty, 6-month = 0%)
 *   - APY bands: Aave/Curve stable 3-8%, Uniswap blue-chip 5-30%, GMX/Velodrome 15-80%+
 */

import { PDPayoffs } from './pd'

export interface Mechanism {
  exitFeePct: number      // % charged on withdrawal (0–0.8 based on GMX GLP range)
  lockupWeeks: number     // weeks LP cannot withdraw (0–208; Curve max = 208w)
  vestingPenaltyPct: number // % of rewards forfeited on early exit (0–50; Camelot xGRAIL)
}

export interface ProtocolPreset {
  id: string
  name: string
  description: string
  mechanism: Mechanism
  typicalAprRange: [number, number]
  source: string
}

export const PROTOCOL_PRESETS: ProtocolPreset[] = [
  {
    id: 'uniswap-v3',
    name: 'Uniswap v3',
    description: 'No protocol protections. LPs enter and exit freely. Pure market discipline.',
    mechanism: { exitFeePct: 0, lockupWeeks: 0, vestingPenaltyPct: 0 },
    typicalAprRange: [5, 30],
    source: 'docs.uniswap.org/concepts/protocol/fees',
  },
  {
    id: 'curve-lp',
    name: 'Curve (LP only)',
    description: 'Standard Curve LP with up to 0.02% fee on imbalanced withdrawals. No lockup on the LP position itself.',
    mechanism: { exitFeePct: 0.02, lockupWeeks: 0, vestingPenaltyPct: 0 },
    typicalAprRange: [4, 8],
    source: 'docs.curve.finance/fees/original-architecture/overview',
  },
  {
    id: 'curve-vecrv',
    name: 'Curve veCRV',
    description: 'Lock CRV for up to 4 years (208 weeks) to boost rewards. Lock is absolute — no early exit at all.',
    mechanism: { exitFeePct: 0, lockupWeeks: 208, vestingPenaltyPct: 0 },
    typicalAprRange: [4, 15],
    source: 'resources.curve.finance/vecrv/locking-your-crv',
  },
  {
    id: 'convex-vlcvx',
    name: 'Convex vlCVX',
    description: 'Vote-lock CVX for 16 weeks. Hard lock — tokens cannot be withdrawn early under any condition.',
    mechanism: { exitFeePct: 0, lockupWeeks: 16, vestingPenaltyPct: 0 },
    typicalAprRange: [10, 40],
    source: 'docs.convexfinance.com/convexfinanceintegration/cvx-locking-vlcvx',
  },
  {
    id: 'gmx-glp',
    name: 'GMX (GLP)',
    description: 'Dynamic 0–0.8% rebalancing fee on GLP mint/redeem. Rewards paid as esGMX vest linearly over 365 days.',
    mechanism: { exitFeePct: 0.4, lockupWeeks: 0, vestingPenaltyPct: 25 },
    typicalAprRange: [15, 80],
    source: 'gmxio.gitbook.io/gmx/glp + docs.gmx.io/docs/tokenomics/rewards',
  },
  {
    id: 'camelot',
    name: 'Camelot (xGRAIL)',
    description: 'No LP lockup, but rewards emitted as xGRAIL. Redeeming in 15 days costs a 50% penalty; full 6-month vest returns 100%.',
    mechanism: { exitFeePct: 0, lockupWeeks: 0, vestingPenaltyPct: 50 },
    typicalAprRange: [20, 60],
    source: 'camelotdex.medium.com/camelot-dex-general-overview',
  },
]

/**
 * Apply mechanisms to a base payoff set and return the adjusted payoffs.
 *
 * How each mechanism shifts the matrix:
 *
 * EXIT FEE — reduces T directly (the temptation to exit while others stay is
 * worth less after paying the fee). Also reduces S slightly (you still pay the
 * fee even as a sucker). Modelled as a fraction of the base payoff lost on exit.
 *
 * LOCKUP — reduces T by a time-value-of-money factor: the temptation is worth
 * less if you can't actually realise it for N weeks. Uses a simple discount:
 * lockup discount = lockupWeeks / 208 (max 4yr Curve lock). Also raises R
 * slightly because committed LPs earn more fees from stable depth.
 *
 * VESTING PENALTY — reduces T and S by the penalty fraction since a portion of
 * rewards is forfeited on early exit. Also slightly raises R (full rewards
 * accrue to stayers).
 */
export function applyMechanisms(base: PDPayoffs, m: Mechanism): PDPayoffs {
  const { exitFeePct, lockupWeeks, vestingPenaltyPct } = m

  const exitFee = exitFeePct / 100
  const lockupDiscount = Math.min(lockupWeeks / 208, 1) * 0.35   // max 35% discount on T
  const vestingHaircut = vestingPenaltyPct / 100

  // T: temptation to exit — reduced by all three levers
  const T = r2(base.T * (1 - exitFee) * (1 - lockupDiscount) * (1 - vestingHaircut * 0.6))

  // R: mutual cooperation — slightly boosted by lockup (committed LPs earn more)
  const R = r2(base.R * (1 + lockupDiscount * 0.15))

  // P: mutual defection — exit fee still applies when everyone exits
  const P = r2(base.P * (1 - exitFee * 0.5))

  // S: sucker payoff — exit fee hits you on the way out eventually, vesting penalty hurts
  const S = r2(base.S * (1 - exitFee) * (1 - vestingHaircut * 0.4))

  return enforceBounds({ T, R, P, S }, base)
}

/**
 * Tipping point: the exit rate (0–1) at which staying becomes irrational.
 *
 * In an N-player pool, your payoff from staying degrades linearly as more LPs
 * exit (rising IL, falling fees, worsening depth). Model: at exit rate x,
 *   payoff(stay) = R - x * (R - S)   → interpolates from R (nobody exits) to S (everyone exits)
 *   payoff(exit) = T - x * (T - P)   → interpolates from T (nobody else exits) to P (everyone exits)
 *
 * The tipping point is where payoff(stay) = payoff(exit):
 *   R - x(R-S) = T - x(T-P)
 *   x = (T - R) / (T - P - R + S)
 *
 * Returns a value in [0,1]. Values > 1 mean staying is always rational (no tipping point).
 * Values < 0 mean exiting is always rational (you're already past the tipping point).
 */
export function tippingPoint(p: PDPayoffs): number {
  const denom = (p.T - p.P) - (p.R - p.S)
  if (Math.abs(denom) < 0.001) return p.T > p.R ? 0 : 1
  const x = (p.T - p.R) / denom
  return Math.min(1, Math.max(0, r2(x)))
}

function r2(n: number) { return Math.round(n * 100) / 100 }

function enforceBounds(p: PDPayoffs, base: PDPayoffs): PDPayoffs {
  let { T, R, P, S } = p
  // Mechanisms can only help, never make things worse than base P/S floor
  if (S < base.S) S = base.S
  if (P < base.P) P = base.P
  // Maintain T >= R >= P >= S ordering
  if (T < R) T = r2(R + 0.01)
  if (R < P) R = r2(P + 0.01)
  if (P < S) P = r2(S + 0.01)
  return { T, R, P, S }
}

/**
 * Generic 2×2 symmetric game engine.
 *
 * All games here share the same structure as the Prisoner's Dilemma:
 * two players, two actions (C / D), symmetric payoffs.
 * What changes between game types is which outcome is the Nash equilibrium
 * and whether cooperation is stable.
 */

export type Action = 'C' | 'D'

export interface Outcome {
  a: number
  b: number
}

export interface GameMatrix {
  CC: Outcome  // both cooperate
  CD: Outcome  // A cooperates, B defects
  DC: Outcome  // A defects,   B cooperates
  DD: Outcome  // both defect
}

export interface NashEquilibrium {
  outcome: keyof GameMatrix
  label: string
  isPareto: boolean  // would any other outcome make both players better off?
}

export interface GameAnalysis {
  matrix: GameMatrix
  nashEquilibria: NashEquilibrium[]
  dominantStrategyA: Action | null
  dominantStrategyB: Action | null
  gameType: GameTypeName
  verdict: string
  verdictSub: string
}

export type GameTypeName =
  | "prisoners-dilemma"
  | "stag-hunt"
  | "chicken"
  | "coordination"

export interface GameTypeDefinition {
  id: GameTypeName
  name: string
  tagline: string
  description: string
  defiAnalogy: string
  defaultPayoffs: { CC: number; CD: number; DC: number; DD: number }
  actionLabels: { C: string; D: string }
}

export const GAME_TYPES: GameTypeDefinition[] = [
  {
    id: "prisoners-dilemma",
    name: "Prisoner's Dilemma",
    tagline: "Individual rationality, collective failure",
    description:
      "Each player has a dominant strategy to defect, yet mutual defection is worse for both than mutual cooperation. The tension between self-interest and collective good is irreducible.",
    defiAnalogy:
      "LPs exiting a healthy pool: each LP is better off exiting regardless of what others do, so everyone exits and the pool collapses, even though staying would have been best for all.",
    defaultPayoffs: { CC: 3, CD: 0, DC: 5, DD: 1 },
    actionLabels: { C: "Stay in pool", D: "Exit pool" },
  },
  {
    id: "stag-hunt",
    name: "Stag Hunt",
    tagline: "Coordination risk: trust determines the outcome",
    description:
      "Two Nash equilibria exist: both cooperate (best) or both defect (safe). There is no dominant strategy. The rational move depends entirely on what you believe the other player will do. High reward requires mutual trust.",
    defiAnalogy:
      "Bootstrapping a new liquidity pool: if both LPs commit capital, the pool thrives (stag). If either doubts the other and hedges, both end up in smaller, fragmented positions (hare). The dilemma is about trust, not temptation.",
    defaultPayoffs: { CC: 4, CD: 0, DC: 3, DD: 2 },
    actionLabels: { C: "Commit capital", D: "Hedge / go small" },
  },
  {
    id: "chicken",
    name: "Chicken (Hawk-Dove)",
    tagline: "One must yield. But who blinks first?",
    description:
      "Each player wants the other to back down (defect). If both hold firm, it is the worst outcome for both. The Nash equilibria are asymmetric: one cooperates, one defects. The game is about who has the credibility to commit to not yielding.",
    defiAnalogy:
      "Two large LPs racing to exit during a market panic: if both dump simultaneously, the price crashes and both get terrible execution. One should stay (yield) and one should exit, but neither wants to be the one who stays.",
    defaultPayoffs: { CC: 3, CD: 1, DC: 5, DD: 0 },
    actionLabels: { C: "Hold position", D: "Dump / exit" },
  },
  {
    id: "coordination",
    name: "Coordination Game",
    tagline: "Any shared convention beats no convention",
    description:
      "Both players prefer to match each other's action, but have no conflicting interests. Multiple Nash equilibria exist and all are Pareto-efficient. The only problem is coordinating on the same one.",
    defiAnalogy:
      "Choosing a DEX standard or token bridge: everyone benefits if the ecosystem rallies around one protocol, but without a coordination mechanism, liquidity fragments across competing forks.",
    defaultPayoffs: { CC: 4, CD: 0, DC: 0, DD: 3 },
    actionLabels: { C: "Protocol A", D: "Protocol B" },
  },
]

function dominantStrategy(
  matrix: GameMatrix,
  player: 'A' | 'B'
): Action | null {
  const get = (o: Outcome) => (player === 'A' ? o.a : o.b)

  // When opponent plays C
  const myC_oppC = player === 'A' ? get(matrix.CC) : get(matrix.CC)
  const myD_oppC = player === 'A' ? get(matrix.DC) : get(matrix.CD)
  // When opponent plays D
  const myC_oppD = player === 'A' ? get(matrix.CD) : get(matrix.DC)
  const myD_oppD = player === 'A' ? get(matrix.DD) : get(matrix.DD)

  const D_beats_C_when_oppC = myD_oppC > myC_oppC
  const D_beats_C_when_oppD = myD_oppD > myC_oppD
  const C_beats_D_when_oppC = myC_oppC > myD_oppC
  const C_beats_D_when_oppD = myC_oppD > myD_oppD

  if (
    (D_beats_C_when_oppC || myD_oppC === myC_oppC) &&
    (D_beats_C_when_oppD || myD_oppD === myC_oppD) &&
    (D_beats_C_when_oppC || D_beats_C_when_oppD)
  ) return 'D'

  if (
    (C_beats_D_when_oppC || myC_oppC === myD_oppC) &&
    (C_beats_D_when_oppD || myC_oppD === myD_oppD) &&
    (C_beats_D_when_oppC || C_beats_D_when_oppD)
  ) return 'C'

  return null
}

function isNash(matrix: GameMatrix, outcome: keyof GameMatrix): boolean {
  // An outcome is Nash if neither player can unilaterally improve by switching
  const o = matrix[outcome]

  if (outcome === 'CC') {
    return matrix.DC.a <= o.a && matrix.CD.b <= o.b
  }
  if (outcome === 'CD') {
    return matrix.DD.a <= o.a && matrix.CC.b <= o.b
  }
  if (outcome === 'DC') {
    return matrix.CC.a <= o.a && matrix.DD.b <= o.b
  }
  // DD
  return matrix.CD.a <= o.a && matrix.DC.b <= o.b
}

function isParetoOptimal(matrix: GameMatrix, outcome: keyof GameMatrix): boolean {
  const o = matrix[outcome]
  const all = (['CC', 'CD', 'DC', 'DD'] as const)
  return !all.some((k) => {
    const other = matrix[k]
    return other.a >= o.a && other.b >= o.b && (other.a > o.a || other.b > o.b)
  })
}

const OUTCOME_LABELS: Record<keyof GameMatrix, string> = {
  CC: 'Both cooperate (C,C)',
  CD: 'A cooperates, B defects (C,D)',
  DC: 'A defects, B cooperates (D,C)',
  DD: 'Both defect (D,D)',
}

export function analyzeGame(
  payoffs: { CC: number; CD: number; DC: number; DD: number },
  gameType: GameTypeName
): GameAnalysis {
  const { CC, CD, DC, DD } = payoffs
  const matrix: GameMatrix = {
    CC: { a: CC, b: CC },
    CD: { a: CD, b: DC },  // A gets sucker, B gets temptation
    DC: { a: DC, b: CD },  // A gets temptation, B gets sucker
    DD: { a: DD, b: DD },
  }

  const nashEquilibria: NashEquilibrium[] = (
    ['CC', 'CD', 'DC', 'DD'] as const
  )
    .filter((k) => isNash(matrix, k))
    .map((k) => ({
      outcome: k,
      label: OUTCOME_LABELS[k],
      isPareto: isParetoOptimal(matrix, k),
    }))

  const domA = dominantStrategy(matrix, 'A')
  const domB = dominantStrategy(matrix, 'B')

  const verdict = buildVerdict(nashEquilibria, domA, domB, gameType)
  const verdictSub = buildVerdictSub(nashEquilibria, domA, gameType)

  return { matrix, nashEquilibria, dominantStrategyA: domA, dominantStrategyB: domB, gameType, verdict, verdictSub }
}

function buildVerdict(
  nash: NashEquilibrium[],
  domA: Action | null,
  _domB: Action | null,
  gameType: GameTypeName
): string {
  if (nash.length === 0) return 'No pure-strategy Nash equilibrium exists in this game.'
  if (nash.length === 1) {
    const n = nash[0]
    if (domA === 'D' && gameType === 'prisoners-dilemma') {
      return 'Mutual defection (D,D) is the unique Nash equilibrium, the classic dilemma.'
    }
    return `Unique Nash equilibrium: ${n.label}.`
  }
  if (nash.length === 2) {
    if (gameType === 'stag-hunt') {
      return 'Two equilibria: mutual cooperation (best) and mutual defection (safe). Which one you land on depends on trust.'
    }
    if (gameType === 'chicken') {
      return 'Two asymmetric equilibria: one player cooperates, the other defects. The game is about who yields.'
    }
    if (gameType === 'coordination') {
      return 'Two equilibria, both are fine. The challenge is coordinating on the same one.'
    }
    return `Two Nash equilibria exist: ${nash.map((n) => n.outcome).join(' and ')}.`
  }
  return `${nash.length} Nash equilibria exist.`
}

function buildVerdictSub(
  nash: NashEquilibrium[],
  _domA: Action | null,
  gameType: GameTypeName
): string {
  const nonParetoNash = nash.filter((n) => !n.isPareto)
  if (gameType === 'prisoners-dilemma') {
    return 'Both players are individually rational in choosing D, even though (C,C) gives a higher payoff to both. Good mechanism design, like repeated interaction or slashing, can escape this trap.'
  }
  if (gameType === 'stag-hunt') {
    return 'The Pareto-dominant equilibrium (C,C) requires mutual trust. Without a coordination mechanism, players may play it safe and land on the inferior (D,D) equilibrium.'
  }
  if (gameType === 'chicken') {
    return 'The worst outcome is mutual defection. Both lose. Real-world resolution often depends on credible commitment: whoever convinces the other they will not yield, wins.'
  }
  if (gameType === 'coordination') {
    return 'Neither equilibrium dominates the other in terms of individual payoffs. A shared convention, focal point, or governance mechanism is enough to solve this.'
  }
  if (nonParetoNash.length > 0) {
    return 'Some Nash equilibria are Pareto-inefficient. Players could all do better by coordinating on a different outcome.'
  }
  return 'All Nash equilibria in this game are Pareto-optimal.'
}

export type Strategy = 'C' | 'D'

export interface PDPayoffs {
  T: number
  R: number
  P: number
  S: number
}

export interface Outcome {
  a: number
  b: number
  label: string
}

export interface PDAnalysis {
  CC: Outcome
  CD: Outcome
  DC: Outcome
  DD: Outcome
  dominantStrategyA: Strategy | null
  dominantStrategyB: Strategy | null
  isPrisonersDilemma: boolean
}

function hasDominantStrategyForA(analysis: { CC: Outcome; CD: Outcome; DC: Outcome; DD: Outcome }): Strategy | null {
  // Compare A's payoffs when B plays C vs D
  const a_C_when_B_C = analysis.CC.a
  const a_D_when_B_C = analysis.DC.a
  const a_C_when_B_D = analysis.CD.a
  const a_D_when_B_D = analysis.DD.a

  const C_better_or_equal_when_B_C = a_C_when_B_C >= a_D_when_B_C
  const D_better_or_equal_when_B_C = a_D_when_B_C >= a_C_when_B_C

  const C_better_or_equal_when_B_D = a_C_when_B_D >= a_D_when_B_D
  const D_better_or_equal_when_B_D = a_D_when_B_D >= a_C_when_B_D

  if (D_better_or_equal_when_B_C && D_better_or_equal_when_B_D && (a_D_when_B_C > a_C_when_B_C || a_D_when_B_D > a_C_when_B_D)) {
    return 'D'
  }
  if (C_better_or_equal_when_B_C && C_better_or_equal_when_B_D && (a_C_when_B_C > a_D_when_B_C || a_C_when_B_D > a_D_when_B_D)) {
    return 'C'
  }
  return null
}

function hasDominantStrategyForB(analysis: { CC: Outcome; CD: Outcome; DC: Outcome; DD: Outcome }): Strategy | null {
  // Compare B's payoffs when A plays C vs D
  const b_when_A_C_B_C = analysis.CC.b
  const b_when_A_C_B_D = analysis.CD.b
  const b_when_A_D_B_C = analysis.DC.b
  const b_when_A_D_B_D = analysis.DD.b

  const C_better_or_equal_when_A_C = b_when_A_C_B_C >= b_when_A_C_B_D
  const D_better_or_equal_when_A_C = b_when_A_C_B_D >= b_when_A_C_B_C

  const C_better_or_equal_when_A_D = b_when_A_D_B_C >= b_when_A_D_B_D
  const D_better_or_equal_when_A_D = b_when_A_D_B_D >= b_when_A_D_B_C

  if (D_better_or_equal_when_A_C && D_better_or_equal_when_A_D && (b_when_A_D_B_D > b_when_A_D_B_C || b_when_A_C_B_D > b_when_A_C_B_C)) {
    return 'D'
  }
  if (C_better_or_equal_when_A_C && C_better_or_equal_when_A_D && (b_when_A_D_B_C > b_when_A_D_B_D || b_when_A_C_B_C > b_when_A_C_B_D)) {
    return 'C'
  }
  return null
}

export function analyzePD(payoffs: PDPayoffs): PDAnalysis {
  const { T, R, P, S } = payoffs

  const CC: Outcome = { a: R, b: R, label: 'Both cooperate (C,C)' }
  const CD: Outcome = { a: S, b: T, label: 'A cooperates, B defects (C,D)' }
  const DC: Outcome = { a: T, b: S, label: 'A defects, B cooperates (D,C)' }
  const DD: Outcome = { a: P, b: P, label: 'Both defect (D,D)' }

  const baseAnalysis = { CC, CD, DC, DD }

  const dominantStrategyA = hasDominantStrategyForA(baseAnalysis)
  const dominantStrategyB = hasDominantStrategyForB(baseAnalysis)

  const isPrisonersDilemma = T > R && R > P && P > S && 2 * R > T + S

  return {
    CC,
    CD,
    DC,
    DD,
    dominantStrategyA,
    dominantStrategyB,
    isPrisonersDilemma,
  }
}

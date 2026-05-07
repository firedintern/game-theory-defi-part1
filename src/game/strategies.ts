import { Strategy } from './pd'

export type StrategyName =
  | 'always-cooperate'
  | 'always-defect'
  | 'tit-for-tat'
  | 'grim-trigger'
  | 'random'

export interface RoundResult {
  round: number
  moveA: Strategy
  moveB: Strategy
  payoffA: number
  payoffB: number
  cumulativeA: number
  cumulativeB: number
}

export interface SimulationResult {
  rounds: RoundResult[]
  totalA: number
  totalB: number
  strategyA: StrategyName
  strategyB: StrategyName
}

type StrategyFn = (history: RoundResult[], playingAs: 'A' | 'B') => Strategy

function makeStrategy(name: StrategyName): StrategyFn {
  switch (name) {
    case 'always-cooperate':
      return () => 'C'

    case 'always-defect':
      return () => 'D'

    case 'tit-for-tat':
      return (history, playingAs) => {
        if (history.length === 0) return 'C'
        const last = history[history.length - 1]
        return playingAs === 'A' ? last.moveB : last.moveA
      }

    case 'grim-trigger':
      return (history, playingAs) => {
        const opponentEverDefected = history.some((r) =>
          playingAs === 'A' ? r.moveB === 'D' : r.moveA === 'D'
        )
        return opponentEverDefected ? 'D' : 'C'
      }

    case 'random':
      return () => (Math.random() < 0.5 ? 'C' : 'D')
  }
}

export interface PDPayoffsForSim {
  T: number
  R: number
  P: number
  S: number
}

function resolvePayoffs(
  moveA: Strategy,
  moveB: Strategy,
  { T, R, P, S }: PDPayoffsForSim
): { payoffA: number; payoffB: number } {
  if (moveA === 'C' && moveB === 'C') return { payoffA: R, payoffB: R }
  if (moveA === 'C' && moveB === 'D') return { payoffA: S, payoffB: T }
  if (moveA === 'D' && moveB === 'C') return { payoffA: T, payoffB: S }
  return { payoffA: P, payoffB: P }
}

export function simulate(
  strategyA: StrategyName,
  strategyB: StrategyName,
  payoffs: PDPayoffsForSim,
  numRounds: number
): SimulationResult {
  const fnA = makeStrategy(strategyA)
  const fnB = makeStrategy(strategyB)
  const rounds: RoundResult[] = []
  let cumulativeA = 0
  let cumulativeB = 0

  for (let i = 0; i < numRounds; i++) {
    const moveA = fnA(rounds, 'A')
    const moveB = fnB(rounds, 'B')
    const { payoffA, payoffB } = resolvePayoffs(moveA, moveB, payoffs)
    cumulativeA += payoffA
    cumulativeB += payoffB
    rounds.push({
      round: i + 1,
      moveA,
      moveB,
      payoffA,
      payoffB,
      cumulativeA,
      cumulativeB,
    })
  }

  return { rounds, totalA: cumulativeA, totalB: cumulativeB, strategyA, strategyB }
}

export const STRATEGY_LABELS: Record<StrategyName, string> = {
  'always-cooperate': 'Always Cooperate',
  'always-defect': 'Always Defect',
  'tit-for-tat': 'Tit-for-Tat',
  'grim-trigger': 'Grim Trigger',
  random: 'Random (50/50)',
}

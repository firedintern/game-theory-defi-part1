import React, { useMemo, useState } from 'react'
import { analyzePD, PDAnalysis } from './game/pd'
import { simulate, StrategyName, STRATEGY_LABELS, SimulationResult } from './game/strategies'
import { GAME_TYPES, GameTypeName, analyzeGame, GameAnalysis } from './game/games'
import PoolSearch from './components/PoolSearch'
import MechanismTab from './components/MechanismTab'

const r2 = (n: number) => Math.round(n * 100) / 100

const DEFAULT_PAYOFFS = { T: 5, R: 3, P: 1, S: 0 }
const STRATEGIES: StrategyName[] = ['always-cooperate', 'always-defect', 'tit-for-tat', 'grim-trigger', 'random']

const GLOSSARY: Record<string, string> = {
  nash: 'A Nash equilibrium is a situation where no player can do better by changing only their own move. In other words, both players are doing the best they can given what the other is doing. Named after mathematician John Nash.',
  pareto: 'Pareto-optimal means you cannot make one player better off without making the other worse off. A Nash equilibrium marked with ★ is Pareto-optimal: there is no other outcome where everyone wins more.',
  dominant: 'A dominant strategy is a move that is always the best choice regardless of what the other player does. If one exists, a rational player will always pick it.',
}

function Tooltip({ term, children }: { term: keyof typeof GLOSSARY; children: React.ReactNode }) {
  const [pos, setPos] = React.useState<{ x: number; y: number } | null>(null)

  function handleMove(e: React.MouseEvent) {
    setPos({ x: e.clientX, y: e.clientY })
  }

  return (
    <span
      className="tooltip-wrap"
      onMouseEnter={(e) => setPos({ x: e.clientX, y: e.clientY })}
      onMouseMove={handleMove}
      onMouseLeave={() => setPos(null)}
    >
      <span className="tooltip-trigger">{children}</span>
      {pos && (
        <span
          className="tooltip-box"
          style={{
            left: Math.min(pos.x + 12, window.innerWidth - 280),
            top: pos.y + 16,
          }}
        >
          {GLOSSARY[term]}
        </span>
      )}
    </span>
  )
}

function parseNumber(value: string, fallback: number): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

type Tab = 'matrix' | 'simulation' | 'playground' | 'mechanisms'

const PAYOFF_HINTS: Record<string, string> = {
  T: 'Exit while others stay. Dodge future risk, keep past gains.',
  R: 'Everyone stays. The pool is healthy and fees flow to all.',
  P: 'Everyone exits. The rush for the door hurts everyone.',
  S: 'Stay while others exit. You end up stuck in a drained pool.',
}

const STRATEGY_HINTS: Record<StrategyName, string> = {
  'always-cooperate': 'Stays in the pool every round, no matter what.',
  'always-defect': 'Pulls liquidity every round, no matter what.',
  'tit-for-tat': "Cooperates first, then mirrors the other player's last move.",
  'grim-trigger': 'Cooperates until betrayed, then defects forever.',
  'random': 'Random 50/50 each round.',
}

const App: React.FC = () => {
  const [tab, setTab] = useState<Tab>('matrix')
  const [showExplainer, setShowExplainer] = useState(false)
  const [selectedPool, setSelectedPool] = useState<string>('manual')

  // Matrix / Simulation payoffs
  const [T, setT] = useState(DEFAULT_PAYOFFS.T.toString())
  const [R, setR] = useState(DEFAULT_PAYOFFS.R.toString())
  const [P, setP] = useState(DEFAULT_PAYOFFS.P.toString())
  const [S, setS] = useState(DEFAULT_PAYOFFS.S.toString())

  // Simulation
  const [strategyA, setStrategyA] = useState<StrategyName>('tit-for-tat')
  const [strategyB, setStrategyB] = useState<StrategyName>('always-defect')
  const [numRounds, setNumRounds] = useState('20')
  const [simSeed, setSimSeed] = useState(0)

  // Playground
  const [activeGameType, setActiveGameType] = useState<GameTypeName>('prisoners-dilemma')
  const [pgCC, setPgCC] = useState('3')
  const [pgCD, setPgCD] = useState('0')
  const [pgDC, setPgDC] = useState('5')
  const [pgDD, setPgDD] = useState('1')

  function applyLivePool(
    payoffs: { T: number; R: number; P: number; S: number },
    _label: string,
    _stats: { apr: number; volatility: number; whaleShare: number; horizon: number }
  ) {
    setT(payoffs.T.toString())
    setR(payoffs.R.toString())
    setP(payoffs.P.toString())
    setS(payoffs.S.toString())
    setSelectedPool('live')
  }

  function clearLivePool() {
    setSelectedPool('manual')
  }

  function applyGameType(id: GameTypeName) {
    const def = GAME_TYPES.find((g) => g.id === id)!
    setActiveGameType(id)
    setPgCC(def.defaultPayoffs.CC.toString())
    setPgCD(def.defaultPayoffs.CD.toString())
    setPgDC(def.defaultPayoffs.DC.toString())
    setPgDD(def.defaultPayoffs.DD.toString())
  }

  const numeric = useMemo(() => ({
    T: parseNumber(T, DEFAULT_PAYOFFS.T),
    R: parseNumber(R, DEFAULT_PAYOFFS.R),
    P: parseNumber(P, DEFAULT_PAYOFFS.P),
    S: parseNumber(S, DEFAULT_PAYOFFS.S),
  }), [T, R, P, S])

  const analysis: PDAnalysis = useMemo(() => analyzePD(numeric), [numeric])
  const isStrictPD = analysis.isPrisonersDilemma
  const { dominantStrategyA, dominantStrategyB } = analysis

  const conditionsMet = {
    TgtR: numeric.T > numeric.R,
    RgtP: numeric.R > numeric.P,
    PgtS: numeric.P > numeric.S,
    midpoint: 2 * numeric.R > numeric.T + numeric.S,
  }

  const pgPayoffs = useMemo(() => ({
    CC: parseNumber(pgCC, 3),
    CD: parseNumber(pgCD, 0),
    DC: parseNumber(pgDC, 5),
    DD: parseNumber(pgDD, 1),
  }), [pgCC, pgCD, pgDC, pgDD])

  const pgAnalysis: GameAnalysis = useMemo(
    () => analyzeGame(pgPayoffs, activeGameType),
    [pgPayoffs, activeGameType]
  )

  const simResult: SimulationResult = useMemo(() => {
    void simSeed
    return simulate(strategyA, strategyB, numeric, Math.max(1, Math.min(100, parseNumber(numRounds, 20))))
  }, [strategyA, strategyB, numeric, numRounds, simSeed])

  const winner = simResult.totalA > simResult.totalB ? 'A' : simResult.totalB > simResult.totalA ? 'B' : 'Tie'

  const simInsight = (() => {
    if (strategyA === strategyB) return 'Same strategy on both sides. The game is symmetric.'
    if (winner === 'A') return `${STRATEGY_LABELS[strategyA]} outperforms ${STRATEGY_LABELS[strategyB]} over ${simResult.rounds.length} rounds.`
    if (winner === 'B') return `${STRATEGY_LABELS[strategyB]} outperforms ${STRATEGY_LABELS[strategyA]} over ${simResult.rounds.length} rounds.`
    return `Tied after ${simResult.rounds.length} rounds.`
  })()

  const verdictMain = (() => {
    if (!isStrictPD) return "These parameters don't form a strict Prisoner's Dilemma."
    if (dominantStrategyA === 'D' && dominantStrategyB === 'D') return 'Both players will defect, even though cooperating would make both better off.'
    if (dominantStrategyA === 'C' && dominantStrategyB === 'C') return 'Cooperation is individually rational here. The dilemma disappears.'
    if (dominantStrategyA && dominantStrategyB) return `Dominant strategies: A plays ${dominantStrategyA}, B plays ${dominantStrategyB}.`
    if (dominantStrategyA || dominantStrategyB) {
      const who = dominantStrategyA ? 'A' : 'B'
      const strat = dominantStrategyA ?? dominantStrategyB
      return `Only player ${who} has a dominant strategy (${strat}).`
    }
    return 'Neither player has a dominant strategy. The outcome depends on what the other does.'
  })()

  const verdictSub = (() => {
    if (!isStrictPD) return "A valid dilemma needs T > R > P > S and 2R > T + S. Check the conditions panel on the left."
    if (dominantStrategyA === 'D' && dominantStrategyB === 'D') return 'The core tragedy: individual rationality produces a collectively bad outcome. In DeFi, this is a bank run on a healthy pool.'
    if (dominantStrategyA === 'C' && dominantStrategyB === 'C') return 'Good mechanism design can create these conditions by aligning individual and collective incentives.'
    return 'Try the Strategy Simulation tab to see how repeated play and memory change the outcome.'
  })()

  return (
    <div className="app-root">

      {/* ── HERO ── */}
      <header className="hero">
        <div className="hero-text">
          <h1 className="hero-title">DeFi Prisoner's Dilemma</h1>
          <p className="hero-subtitle">
            What happens when individual self-interest works against collective outcomes —
            and how does that play out in DeFi liquidity pools?
          </p>
        </div>
        <button className="explainer-toggle" onClick={() => setShowExplainer((v) => !v)}>
          {showExplainer ? 'Hide intro' : 'What is this? →'}
        </button>
      </header>

      {showExplainer && (
        <div className="explainer">
          <div className="explainer-title">The Prisoner's Dilemma, explained simply</div>
          <p>
            Imagine two people who would both benefit from working together but each one
            is individually better off betraying the other. That tension is the{' '}
            <strong>Prisoner's Dilemma</strong>: rational self-interest leads to a worse
            outcome for everyone.
          </p>
          <p>
            In DeFi, this plays out when liquidity providers decide whether to{' '}
            <strong>stay</strong> in a pool (cooperate) or <strong>exit</strong> (defect).
            If everyone stays, the pool is healthy and fees flow to all. But if you suspect
            others might exit, your individually rational move is to exit first, even if
            it triggers a bank run that hurts everyone, including you.
          </p>
          <div className="explainer-grid">
            <div className="explainer-item">
              <div className="explainer-letter coop">C</div>
              <div><strong>Cooperate = Stay in the pool</strong><br />Keep your liquidity in, trust the system.</div>
            </div>
            <div className="explainer-item">
              <div className="explainer-letter defect">D</div>
              <div><strong>Defect = Exit the pool</strong><br />Pull liquidity out, prioritise your own safety.</div>
            </div>
          </div>
          <p className="explainer-note">
            Use <strong>Payoff Matrix</strong> to tune incentives and see when a dilemma
            exists. Use <strong>Strategy Simulation</strong> to run repeated rounds and
            see which strategies win over time. Use <strong>Game Playground</strong> to
            explore other classic game theory structures.
          </p>
        </div>
      )}

      {/* ── SCENARIO SELECTOR ── */}
      <section className="scenario-section">
        <div className="scenario-header">
          <span className="scenario-label">Start from a real pool</span>
          <span className="scenario-sub">Live data from DeFiLlama. Pools above $1M TVL only.</span>
        </div>
        <PoolSearch onApply={applyLivePool} onClear={clearLivePool} />
      </section>

      {/* ── MAIN WORKSPACE ── */}
      <div className="workspace">

        {/* LEFT SIDEBAR — config */}
        <aside className="sidebar">
          <div className="sidebar-block">
            <div className="sidebar-block-title">Payoffs</div>
            <div className="sidebar-hint">
              {selectedPool === 'live' ? 'Auto-filled from live pool data.' : 'Adjust to reshape the game.'}
            </div>
            <div className="payoff-grid">
              {(['T', 'R', 'P', 'S'] as const).map((key) => {
                const setters = { T: setT, R: setR, P: setP, S: setS }
                const values = { T, R, P, S }
                const labels = { T: 'T: Temptation', R: 'R: Reward', P: 'P: Punishment', S: "S: Sucker's payoff" }
                return (
                  <div className="payoff-field" key={key}>
                    <label htmlFor={key}>{labels[key]}</label>
                    <input id={key} type="number" value={values[key]} onChange={(e) => setters[key](e.target.value)} />
                    <div className="payoff-hint">{PAYOFF_HINTS[key]}</div>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="sidebar-block">
            <div className="sidebar-block-title">Dilemma conditions</div>
            <div className="conditions-list">
              {[
                { ok: conditionsMet.TgtR, text: `T > R  (${numeric.T} > ${numeric.R})` },
                { ok: conditionsMet.RgtP, text: `R > P  (${numeric.R} > ${numeric.P})` },
                { ok: conditionsMet.PgtS, text: `P > S  (${numeric.P} > ${numeric.S})` },
                { ok: conditionsMet.midpoint, text: `2R > T+S  (${r2(2 * numeric.R)} > ${r2(numeric.T + numeric.S)})` },
              ].map(({ ok, text }) => (
                <div key={text} className={ok ? 'condition ok' : 'condition fail'}>
                  <span className="condition-dot">{ok ? '✓' : '✗'}</span>
                  <code>{text}</code>
                </div>
              ))}
            </div>
            <div className={isStrictPD ? 'pd-badge good' : 'pd-badge warn'}>
              {isStrictPD ? "✓ Valid Prisoner's Dilemma" : "✗ Not a strict Prisoner's Dilemma"}
            </div>
          </div>
        </aside>

        {/* RIGHT — tabbed output */}
        <div className="output">
          <div className="tabs">
            <button className={tab === 'matrix' ? 'tab active' : 'tab'} onClick={() => setTab('matrix')}>
              Payoff Matrix
            </button>
            <button className={tab === 'simulation' ? 'tab active' : 'tab'} onClick={() => setTab('simulation')}>
              Strategy Simulation
            </button>
            <button className={tab === 'playground' ? 'tab active' : 'tab'} onClick={() => setTab('playground')}>
              Game Playground
            </button>
            <button className={tab === 'mechanisms' ? 'tab active' : 'tab'} onClick={() => setTab('mechanisms')}>
              Mechanism Design
            </button>
          </div>

          {/* ── TAB: MATRIX ── */}
          {tab === 'matrix' && (
            <div className="tab-content">
              <div className="tab-intro">
                Each cell shows what A and B earn based on their joint choice.
                Rows = A's move, columns = B's move.
              </div>
              <div className="matrix-wrapper">
                <table className="matrix">
                  <thead>
                    <tr>
                      <th />
                      <th><span className="move-c">B stays (C)</span></th>
                      <th><span className="move-d">B exits (D)</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <th><span className="move-c">A stays (C)</span></th>
                      <td className="cell-cc">
                        <div className="cell-inner">
                          <div className="cell-outcome">Both stay</div>
                          <div className="cell-payoffs">A: {analysis.CC.a} · B: {analysis.CC.b}</div>
                        </div>
                      </td>
                      <td className="cell-cd">
                        <div className="cell-inner">
                          <div className="cell-outcome">A left behind</div>
                          <div className="cell-payoffs">A: {analysis.CD.a} · B: {analysis.CD.b}</div>
                        </div>
                      </td>
                    </tr>
                    <tr>
                      <th><span className="move-d">A exits (D)</span></th>
                      <td className="cell-dc">
                        <div className="cell-inner">
                          <div className="cell-outcome">B left behind</div>
                          <div className="cell-payoffs">A: {analysis.DC.a} · B: {analysis.DC.b}</div>
                        </div>
                      </td>
                      <td className="cell-dd">
                        <div className="cell-inner">
                          <div className="cell-outcome">Bank run</div>
                          <div className="cell-payoffs">A: {analysis.DD.a} · B: {analysis.DD.b}</div>
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div className="matrix-summary">
                <div>
                  <strong>A's best move:</strong>{' '}
                  {dominantStrategyA
                    ? dominantStrategyA === 'C' ? 'Stay, always better regardless of B' : 'Exit, always better regardless of B'
                    : 'No dominant strategy, depends on B'}
                </div>
                <div>
                  <strong>B's best move:</strong>{' '}
                  {dominantStrategyB
                    ? dominantStrategyB === 'C' ? 'Stay, always better regardless of A' : 'Exit, always better regardless of A'
                    : 'No dominant strategy, depends on A'}
                </div>
              </div>
            </div>
          )}

          {/* ── TAB: SIMULATION ── */}
          {tab === 'simulation' && (
            <div className="tab-content">
              <div className="tab-intro">
                Pick a strategy for each player and run repeated rounds. The payoffs from the left panel apply every round.
              </div>
              <div className="sim-controls">
                <div className="sim-field">
                  <label>Strategy A</label>
                  <select value={strategyA} onChange={(e) => setStrategyA(e.target.value as StrategyName)}>
                    {STRATEGIES.map((s) => <option key={s} value={s}>{STRATEGY_LABELS[s]}</option>)}
                  </select>
                  <div className="payoff-hint">{STRATEGY_HINTS[strategyA]}</div>
                </div>
                <div className="sim-field">
                  <label>Strategy B</label>
                  <select value={strategyB} onChange={(e) => setStrategyB(e.target.value as StrategyName)}>
                    {STRATEGIES.map((s) => <option key={s} value={s}>{STRATEGY_LABELS[s]}</option>)}
                  </select>
                  <div className="payoff-hint">{STRATEGY_HINTS[strategyB]}</div>
                </div>
                <div className="sim-field">
                  <label>Rounds (1–100)</label>
                  <input type="number" min={1} max={100} value={numRounds} onChange={(e) => setNumRounds(e.target.value)} />
                </div>
                <div className="sim-field sim-field-btn">
                  <button className="btn-rerun" onClick={() => setSimSeed((n) => n + 1)}>Re-run</button>
                </div>
              </div>

              <div className="sim-scores">
                <div className="score-card">
                  <div className="score-label">Player A: {STRATEGY_LABELS[strategyA]}</div>
                  <div className="score-value">{simResult.totalA}</div>
                </div>
                <div className={`score-winner ${winner === 'Tie' ? 'tie' : ''}`}>
                  {winner === 'Tie' ? 'Tie' : `Player ${winner} wins`}
                </div>
                <div className="score-card">
                  <div className="score-label">Player B: {STRATEGY_LABELS[strategyB]}</div>
                  <div className="score-value">{simResult.totalB}</div>
                </div>
              </div>
              <div className="sim-insight">{simInsight}</div>

              <div className="round-table-wrapper">
                <table className="round-table">
                  <thead>
                    <tr>
                      <th>Round</th>
                      <th>A move</th>
                      <th>B move</th>
                      <th>A earns</th>
                      <th>B earns</th>
                      <th>A total</th>
                      <th>B total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {simResult.rounds.map((r) => (
                      <tr key={r.round} className={r.moveA === 'D' || r.moveB === 'D' ? 'row-defect' : 'row-coop'}>
                        <td>{r.round}</td>
                        <td><span className={r.moveA === 'C' ? 'move-c' : 'move-d'}>{r.moveA === 'C' ? 'Stay' : 'Exit'}</span></td>
                        <td><span className={r.moveB === 'C' ? 'move-c' : 'move-d'}>{r.moveB === 'C' ? 'Stay' : 'Exit'}</span></td>
                        <td>{r.payoffA}</td>
                        <td>{r.payoffB}</td>
                        <td>{r.cumulativeA}</td>
                        <td>{r.cumulativeB}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── TAB: PLAYGROUND ── */}
          {tab === 'playground' && (() => {
            const def = GAME_TYPES.find((g) => g.id === activeGameType)!
            const { matrix, nashEquilibria, dominantStrategyA: pgDomA, dominantStrategyB: pgDomB } = pgAnalysis
            const actionC = def.actionLabels.C
            const actionD = def.actionLabels.D

            return (
              <div className="tab-content">
                <div className="tab-intro">
                  Explore other classic game structures and see how the equilibrium changes. Edit payoffs to morph one game into another.
                </div>

                <div className="pg-game-types">
                  {GAME_TYPES.map((g) => (
                    <button
                      key={g.id}
                      className={activeGameType === g.id ? 'pg-type-btn active' : 'pg-type-btn'}
                      onClick={() => applyGameType(g.id)}
                    >
                      <div className="pg-type-name">{g.name}</div>
                      <div className="pg-type-tagline">{g.tagline}</div>
                    </button>
                  ))}
                </div>

                <div className="pg-layout">
                  {/* Left: context + editor */}
                  <div className="pg-left">
                    <p className="pg-desc">{def.description}</p>
                    <div className="pg-defi-block">
                      <div className="pg-defi-label">DeFi analogy</div>
                      <p className="pg-defi-text">{def.defiAnalogy}</p>
                    </div>
                    <div className="pg-editor-title">Payoff editor</div>
                    <div className="pg-payoff-grid">
                      <div className="pg-payoff-header" />
                      <div className="pg-payoff-header"><span className="move-c">B: {actionC}</span></div>
                      <div className="pg-payoff-header"><span className="move-d">B: {actionD}</span></div>
                      <div className="pg-payoff-row-label"><span className="move-c">A: {actionC}</span></div>
                      <div className="pg-payoff-cell pg-cc">
                        <div className="pg-cell-label">(C,C)</div>
                        <input type="number" value={pgCC} onChange={(e) => setPgCC(e.target.value)} />
                      </div>
                      <div className="pg-payoff-cell pg-cd">
                        <div className="pg-cell-label">(C,D)</div>
                        <input type="number" value={pgCD} onChange={(e) => setPgCD(e.target.value)} />
                      </div>
                      <div className="pg-payoff-row-label"><span className="move-d">A: {actionD}</span></div>
                      <div className="pg-payoff-cell pg-dc">
                        <div className="pg-cell-label">(D,C)</div>
                        <input type="number" value={pgDC} onChange={(e) => setPgDC(e.target.value)} />
                      </div>
                      <div className="pg-payoff-cell pg-dd">
                        <div className="pg-cell-label">(D,D)</div>
                        <input type="number" value={pgDD} onChange={(e) => setPgDD(e.target.value)} />
                      </div>
                    </div>
                    <div className="pg-payoff-note">Each value = your payoff when both players choose those actions.</div>
                  </div>

                  {/* Right: matrix + analysis */}
                  <div className="pg-right">
                    <div className="matrix-wrapper">
                      <table className="matrix">
                        <thead>
                          <tr>
                            <th />
                            <th><span className="move-c">B: {actionC} (C)</span></th>
                            <th><span className="move-d">B: {actionD} (D)</span></th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <th><span className="move-c">A: {actionC} (C)</span></th>
                            <td className={nashEquilibria.some((n) => n.outcome === 'CC') ? 'cell-cc cell-nash' : 'cell-cc'}>
                              <div className="cell-inner">
                                {nashEquilibria.some((n) => n.outcome === 'CC') && <div className="nash-badge">Nash</div>}
                                <div className="cell-payoffs">A: {matrix.CC.a} · B: {matrix.CC.b}</div>
                              </div>
                            </td>
                            <td className={nashEquilibria.some((n) => n.outcome === 'CD') ? 'cell-cd cell-nash' : 'cell-cd'}>
                              <div className="cell-inner">
                                {nashEquilibria.some((n) => n.outcome === 'CD') && <div className="nash-badge">Nash</div>}
                                <div className="cell-payoffs">A: {matrix.CD.a} · B: {matrix.CD.b}</div>
                              </div>
                            </td>
                          </tr>
                          <tr>
                            <th><span className="move-d">A: {actionD} (D)</span></th>
                            <td className={nashEquilibria.some((n) => n.outcome === 'DC') ? 'cell-dc cell-nash' : 'cell-dc'}>
                              <div className="cell-inner">
                                {nashEquilibria.some((n) => n.outcome === 'DC') && <div className="nash-badge">Nash</div>}
                                <div className="cell-payoffs">A: {matrix.DC.a} · B: {matrix.DC.b}</div>
                              </div>
                            </td>
                            <td className={nashEquilibria.some((n) => n.outcome === 'DD') ? 'cell-dd cell-nash' : 'cell-dd'}>
                              <div className="cell-inner">
                                {nashEquilibria.some((n) => n.outcome === 'DD') && <div className="nash-badge">Nash</div>}
                                <div className="cell-payoffs">A: {matrix.DD.a} · B: {matrix.DD.b}</div>
                              </div>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    <div className="pg-analysis-rows">
                      <div className="pg-analysis-row">
                        <span className="pg-analysis-label">
                          <Tooltip term="nash">Nash equilibria ⓘ</Tooltip>
                        </span>
                        <span className="pg-analysis-value">
                          {nashEquilibria.length === 0
                            ? <span className="pg-none">None (pure strategy)</span>
                            : nashEquilibria.map((n) => (
                              <span key={n.outcome} className={`nash-tag ${n.isPareto ? 'pareto' : ''}`}>
                                {n.outcome}{n.isPareto ? ' ★' : ''}
                              </span>
                            ))}
                        </span>
                      </div>
                      <div className="pg-analysis-row">
                        <span className="pg-analysis-label">
                          <Tooltip term="dominant">A's dominant strategy ⓘ</Tooltip>
                        </span>
                        <span className="pg-analysis-value">
                          {pgDomA
                            ? <span className={pgDomA === 'C' ? 'move-c' : 'move-d'}>{pgDomA === 'C' ? actionC : actionD}</span>
                            : <span className="pg-none">None, depends on B</span>}
                        </span>
                      </div>
                      <div className="pg-analysis-row">
                        <span className="pg-analysis-label">
                          <Tooltip term="dominant">B's dominant strategy ⓘ</Tooltip>
                        </span>
                        <span className="pg-analysis-value">
                          {pgDomB
                            ? <span className={pgDomB === 'C' ? 'move-c' : 'move-d'}>{pgDomB === 'C' ? actionC : actionD}</span>
                            : <span className="pg-none">None, depends on A</span>}
                        </span>
                      </div>
                      <div className="pg-analysis-row">
                        <span className="pg-analysis-label">
                          <Tooltip term="pareto">★ Pareto-optimal ⓘ</Tooltip>
                        </span>
                        <span className="pg-analysis-value pg-none">no outcome exists that makes both players better off</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )
          })()}

          {/* ── TAB: MECHANISMS ── */}
          {tab === 'mechanisms' && (
            <MechanismTab basePayoffs={numeric} />
          )}

          {/* ── VERDICT BAR ── */}
          <div className="verdict-bar">
            <div className="verdict-main">
              {tab === 'playground' ? pgAnalysis.verdict : verdictMain}
            </div>
            <div className="verdict-sub">
              {tab === 'playground' ? pgAnalysis.verdictSub : verdictSub}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default App

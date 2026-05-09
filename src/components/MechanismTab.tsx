import React, { useMemo, useState } from 'react'
import {
  PROTOCOL_PRESETS,
  applyMechanisms,
  tippingPoint,
  Mechanism,
} from '../game/mechanisms'
import { PDPayoffs } from '../game/pd'

interface Props {
  basePayoffs: PDPayoffs
}

const r2 = (n: number) => Math.round(n * 100) / 100

function PayoffDelta({ base, adjusted, label }: { base: number; adjusted: number; label: string }) {
  const delta = r2(adjusted - base)
  const pct = base !== 0 ? r2(((adjusted - base) / Math.abs(base)) * 100) : 0
  const positive = delta > 0
  const neutral = delta === 0
  return (
    <div className="mech-payoff-row">
      <span className="mech-payoff-label">{label}</span>
      <span className="mech-payoff-base">{base}</span>
      <span className="mech-payoff-arrow">→</span>
      <span className={`mech-payoff-adj ${neutral ? 'neutral' : positive ? 'better' : 'worse'}`}>
        {adjusted}
      </span>
      {!neutral && (
        <span className={`mech-payoff-delta ${positive ? 'better' : 'worse'}`}>
          {positive ? '+' : ''}{delta} ({positive ? '+' : ''}{pct}%)
        </span>
      )}
      {neutral && <span className="mech-payoff-delta neutral">no change</span>}
    </div>
  )
}

function TippingBar({ value, label }: { value: number; label: string }) {
  const pct = Math.round(value * 100)
  const color = pct >= 60 ? '#34d399' : pct >= 35 ? '#fbbf24' : '#f87171'
  return (
    <div className="mech-tip-bar-wrap">
      <div className="mech-tip-bar-labels">
        <span>{label}</span>
        <span className="mech-tip-pct" style={{ color }}>{pct}% TVL exit</span>
      </div>
      <div className="mech-tip-track">
        <div className="mech-tip-fill" style={{ width: `${pct}%`, background: color }} />
        <div className="mech-tip-marker" style={{ left: `${pct}%` }} />
      </div>
      <div className="mech-tip-hint">
        {pct >= 60
          ? 'Pool is resilient. Cooperation holds even if most LPs exit.'
          : pct >= 35
          ? 'Moderate risk. A coordinated exit by a third of LPs could trigger a cascade.'
          : 'Fragile. Even a small panic can flip the rational choice from stay to exit.'}
      </div>
    </div>
  )
}

export default function MechanismTab({ basePayoffs }: Props) {
  const [selectedPreset, setSelectedPreset] = useState<string>('uniswap-v3')
  const [exitFee, setExitFee] = useState(0)
  const [lockupWeeks, setLockupWeeks] = useState(0)
  const [vestingPenalty, setVestingPenalty] = useState(0)

  function applyPreset(id: string) {
    const preset = PROTOCOL_PRESETS.find((p) => p.id === id)!
    setSelectedPreset(id)
    setExitFee(preset.mechanism.exitFeePct)
    setLockupWeeks(preset.mechanism.lockupWeeks)
    setVestingPenalty(preset.mechanism.vestingPenaltyPct)
  }

  const mechanism: Mechanism = { exitFeePct: exitFee, lockupWeeks, vestingPenaltyPct: vestingPenalty }
  const adjusted = useMemo(() => applyMechanisms(basePayoffs, mechanism), [basePayoffs, mechanism])
  const baseTip = useMemo(() => tippingPoint(basePayoffs), [basePayoffs])
  const adjTip = useMemo(() => tippingPoint(adjusted), [adjusted])

  const baseIsCoopDominant = basePayoffs.R >= basePayoffs.T
  const adjIsCoopDominant = adjusted.R >= adjusted.T

  const equilibriumFlipped = !baseIsCoopDominant && adjIsCoopDominant
  const stillDefect = !baseIsCoopDominant && !adjIsCoopDominant
  const alreadyCoop = baseIsCoopDominant

  const activePreset = PROTOCOL_PRESETS.find((p) => p.id === selectedPreset)!

  return (
    <div className="tab-content mech-tab">
      <div className="tab-intro">
        Real protocols use three levers to fight bank-run dynamics. See how each one shifts the
        payoff matrix and moves the tipping point — the exit rate at which staying becomes irrational.
        Payoffs are pulled live from the left panel.
      </div>

      {/* Protocol presets */}
      <div className="mech-presets">
        <div className="mech-section-label">Protocol presets <span className="mech-source-note">sourced from live docs</span></div>
        <div className="mech-preset-grid">
          {PROTOCOL_PRESETS.map((p) => (
            <button
              key={p.id}
              className={`mech-preset-btn ${selectedPreset === p.id ? 'active' : ''}`}
              onClick={() => applyPreset(p.id)}
            >
              <span className="mech-preset-name">{p.name}</span>
              <span className="mech-preset-apr">{p.typicalAprRange[0]}–{p.typicalAprRange[1]}% APR</span>
            </button>
          ))}
        </div>
        <div className="mech-preset-desc">
          {activePreset.description}
          <a
            className="mech-source-link"
            href={`https://${activePreset.source}`}
            target="_blank"
            rel="noreferrer"
          >
            Source
          </a>
        </div>
      </div>

      {/* Sliders */}
      <div className="mech-sliders">
        <div className="mech-section-label">Adjust mechanisms</div>
        <div className="mech-slider-grid">

          <div className="mech-slider-block">
            <div className="mech-slider-header">
              <span className="mech-slider-name">Exit fee</span>
              <span className="mech-slider-val">{exitFee.toFixed(2)}%</span>
            </div>
            <input type="range" min={0} max={0.8} step={0.01}
              value={exitFee} onChange={(e) => { setSelectedPreset('custom'); setExitFee(Number(e.target.value)) }} />
            <div className="mech-slider-range">
              <span>0% (Uniswap, Aave)</span>
              <span>0.8% (GMX GLP max)</span>
            </div>
            <div className="mech-slider-hint">
              Charged on withdrawal. Directly lowers the temptation payoff T by reducing what an exiting LP takes home.
            </div>
          </div>

          <div className="mech-slider-block">
            <div className="mech-slider-header">
              <span className="mech-slider-name">Lockup period</span>
              <span className="mech-slider-val">
                {lockupWeeks === 0 ? 'None' : lockupWeeks < 4 ? `${lockupWeeks}w` : lockupWeeks < 52 ? `${lockupWeeks}w (${(lockupWeeks / 4.33).toFixed(0)}mo)` : `${(lockupWeeks / 52).toFixed(1)}yr`}
              </span>
            </div>
            <input type="range" min={0} max={208} step={1}
              value={lockupWeeks} onChange={(e) => { setSelectedPreset('custom'); setLockupWeeks(Number(e.target.value)) }} />
            <div className="mech-slider-range">
              <span>None</span>
              <span>16w (Convex)</span>
              <span>4yr (Curve veCRV)</span>
            </div>
            <div className="mech-slider-hint">
              Hard lock — LP cannot exit at all during this period. Eliminates the exit option, discounting T by time-value.
            </div>
          </div>

          <div className="mech-slider-block">
            <div className="mech-slider-header">
              <span className="mech-slider-name">Early exit penalty</span>
              <span className="mech-slider-val">{vestingPenalty}% of rewards forfeited</span>
            </div>
            <input type="range" min={0} max={50} step={1}
              value={vestingPenalty} onChange={(e) => { setSelectedPreset('custom'); setVestingPenalty(Number(e.target.value)) }} />
            <div className="mech-slider-range">
              <span>0% (no penalty)</span>
              <span>50% (Camelot 15-day vest)</span>
            </div>
            <div className="mech-slider-hint">
              Fraction of accrued rewards forfeited if you exit before the full vesting period. Camelot xGRAIL charges exactly 50% for a 15-day vest vs 0% for a 6-month vest.
            </div>
          </div>

        </div>
      </div>

      {/* Payoff impact */}
      <div className="mech-impact">
        <div className="mech-section-label">How payoffs shift</div>
        <div className="mech-payoff-table">
          <div className="mech-payoff-header-row">
            <span className="mech-payoff-label">Payoff</span>
            <span className="mech-payoff-base">Base</span>
            <span className="mech-payoff-arrow" />
            <span className="mech-payoff-adj">With mechanisms</span>
            <span className="mech-payoff-delta">Change</span>
          </div>
          <PayoffDelta base={basePayoffs.T} adjusted={adjusted.T} label="T — Temptation (exit while others stay)" />
          <PayoffDelta base={basePayoffs.R} adjusted={adjusted.R} label="R — Reward (both stay)" />
          <PayoffDelta base={basePayoffs.P} adjusted={adjusted.P} label="P — Punishment (everyone exits)" />
          <PayoffDelta base={basePayoffs.S} adjusted={adjusted.S} label="S — Sucker (stay while others exit)" />
        </div>

        <div className={`mech-equilibrium-badge ${equilibriumFlipped ? 'flipped' : stillDefect ? 'defect' : 'coop'}`}>
          {equilibriumFlipped && '✓ Equilibrium flipped: cooperation is now the dominant strategy'}
          {stillDefect && '✗ Still a dilemma: defection remains dominant despite the mechanisms'}
          {alreadyCoop && '✓ Cooperation was already dominant with these base payoffs'}
        </div>
      </div>

      {/* Tipping point */}
      <div className="mech-tipping">
        <div className="mech-section-label">Bank-run tipping point</div>
        <div className="mech-tip-note">
          In a real pool, your payoff degrades as other LPs exit (rising impermanent loss, falling fees).
          This is the exit rate at which staying becomes irrational for you.
        </div>
        <div className="mech-tip-bars">
          <TippingBar value={baseTip} label="Without mechanisms" />
          <TippingBar value={adjTip} label="With mechanisms" />
        </div>
        {adjTip > baseTip && (
          <div className="mech-tip-improvement">
            Mechanisms shifted the tipping point by +{Math.round((adjTip - baseTip) * 100)} percentage points.
            {adjTip - baseTip >= 0.3 ? ' A significant improvement in pool resilience.' : ''}
          </div>
        )}
      </div>

    </div>
  )
}

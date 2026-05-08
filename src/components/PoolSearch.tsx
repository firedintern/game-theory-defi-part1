import React, { useEffect, useRef, useState } from 'react'
import {
  fetchPools,
  fetchVolatility,
  searchPools,
  formatTvl,
  LlamaPoolResolved,
} from '../game/defillama'
import { poolToPD } from '../game/defi'
import { PDPayoffs } from '../game/pd'

interface Props {
  onApply: (payoffs: PDPayoffs, label: string, stats: { apr: number; volatility: number; whaleShare: number; horizon: number }) => void
  onClear: () => void
}

type LoadState = 'idle' | 'loading' | 'ready' | 'error'

export default function PoolSearch({ onApply, onClear }: Props) {
  const [loadState, setLoadState] = useState<LoadState>('idle')
  const [pools, setPools] = useState<LlamaPoolResolved[]>([])
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<LlamaPoolResolved[]>([])
  const [selected, setSelected] = useState<LlamaPoolResolved | null>(null)
  const [open, setOpen] = useState(false)
  const [fetching, setFetching] = useState(false)
  const [whaleShare, setWhaleShare] = useState(40)
  const [horizon, setHorizon] = useState(90)
  const [volatility, setVolatility] = useState<number | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)

  // Load pools list on first focus
  async function ensureLoaded() {
    if (loadState !== 'idle') return
    setLoadState('loading')
    try {
      const data = await fetchPools()
      setPools(data)
      setLoadState('ready')
    } catch {
      setLoadState('error')
    }
  }

  useEffect(() => {
    if (loadState !== 'ready') return
    setResults(searchPools(pools, query))
    setOpen(query.trim().length > 0)
  }, [query, pools, loadState])

  // Close dropdown on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  async function selectPool(pool: LlamaPoolResolved) {
    setSelected(pool)
    setQuery(`${pool.symbol} — ${pool.project} (${pool.chain})`)
    setOpen(false)
    setFetching(true)
    setVolatility(null)
    try {
      const vol = await fetchVolatility(pool.id)
      setVolatility(vol)
    } catch {
      setVolatility(0.3)
    } finally {
      setFetching(false)
    }
  }

  function apply() {
    if (!selected) return
    const vol = volatility ?? 0.3
    const stats = {
      apr: selected.apr,
      volatility: vol,
      whaleShare: whaleShare / 100,
      horizon,
    }
    const payoffs = poolToPD(stats)
    const label = `${selected.symbol} (${selected.project})`
    onApply(payoffs, label, stats)
  }

  function clear() {
    setSelected(null)
    setQuery('')
    setVolatility(null)
    setResults([])
    onClear()
  }

  return (
    <div className="pool-search" ref={wrapRef}>
      <div className="pool-search-row">
        <div className="pool-search-input-wrap">
          <input
            ref={inputRef}
            className="pool-search-input"
            type="text"
            placeholder={loadState === 'loading' ? 'Loading pools...' : 'Search by token, protocol, or chain...'}
            value={query}
            onFocus={ensureLoaded}
            onChange={(e) => {
              setQuery(e.target.value)
              if (selected) { setSelected(null); setVolatility(null) }
            }}
            disabled={loadState === 'loading'}
          />
          {loadState === 'error' && (
            <span className="pool-search-error-icon" title="Failed to load pools">!</span>
          )}
          {selected && (
            <button className="pool-search-clear" onClick={clear} title="Clear">×</button>
          )}
        </div>
      </div>

      {open && !selected && results.length > 0 && (
        <div className="pool-dropdown">
          {results.map((p) => (
            <button key={p.id} className="pool-dropdown-item" onClick={() => selectPool(p)}>
              <span className="pool-item-symbol">{p.symbol}</span>
              <span className="pool-item-meta">{p.project} · {p.chain}</span>
              <span className="pool-item-stats">
                <span className="pool-item-apr">{p.apr}% APR</span>
                <span className="pool-item-tvl">{formatTvl(p.tvlUsd)}</span>
              </span>
            </button>
          ))}
        </div>
      )}

      {open && !selected && query.trim().length > 0 && results.length === 0 && loadState === 'ready' && (
        <div className="pool-dropdown pool-dropdown-empty">No pools found above $1M TVL</div>
      )}

      {selected && (
        <div className="pool-config">
          <div className="pool-config-fetched">
            <span className="pool-config-stat">
              <span className="pool-stat-label">APR</span>
              <span className="pool-stat-value">{selected.apr}%</span>
            </span>
            <span className="pool-config-stat">
              <span className="pool-stat-label">TVL</span>
              <span className="pool-stat-value">{formatTvl(selected.tvlUsd)}</span>
            </span>
            <span className="pool-config-stat">
              <span className="pool-stat-label">Volatility (30d)</span>
              <span className="pool-stat-value">
                {fetching ? <span className="pool-fetching">calculating...</span> : volatility !== null ? `${Math.round(volatility * 100)}%` : '...'}
              </span>
            </span>
          </div>

          <div className="pool-sliders">
            <div className="pool-slider-row">
              <div className="pool-slider-label">
                <span>Whale concentration</span>
                <span className="pool-slider-value">{whaleShare}%</span>
              </div>
              <input
                type="range" min={0} max={100} step={1}
                value={whaleShare}
                onChange={(e) => setWhaleShare(Number(e.target.value))}
              />
              <div className="pool-slider-hint">
                Estimated share of pool TVL held by the top few LPs. Can't be fetched automatically since it requires on-chain analysis.
              </div>
            </div>

            <div className="pool-slider-row">
              <div className="pool-slider-label">
                <span>Investment horizon</span>
                <span className="pool-slider-value">{horizon} days</span>
              </div>
              <input
                type="range" min={1} max={365} step={1}
                value={horizon}
                onChange={(e) => setHorizon(Number(e.target.value))}
              />
            </div>
          </div>

          <button
            className="pool-apply-btn"
            onClick={apply}
            disabled={fetching}
          >
            {fetching ? 'Fetching volatility...' : 'Apply to payoff model'}
          </button>
        </div>
      )}
    </div>
  )
}

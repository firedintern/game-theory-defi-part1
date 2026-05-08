# Game Theory in DeFi: Part 1

An interactive playground that maps classic game theory concepts onto real DeFi mechanics. Search live pools from DeFiLlama, run multi-round strategy simulations, and explore how game type changes the equilibrium outcome.

Built with React 18 + TypeScript + Vite. No external UI libraries.

---

## What it covers

### Live Pool Search

Search any token, protocol, or chain from DeFiLlama's yield database (pools above $1M TVL only). Selecting a pool auto-fetches APR and computes 30-day APY volatility from historical data. Whale concentration and investment horizon are set via sliders — whale share can't be automated since it requires on-chain analysis across potentially fragmented wallets.

![Pool search](docs/screenshots/readme-poolsearch.png)

### Payoff Matrix

The pool stats feed directly into the T/R/P/S payoff model. The matrix shows what each player earns based on their joint decision (stay or exit), with dominant strategy analysis and a plain-language verdict.

![Payoff Matrix tab](docs/screenshots/readme-matrix.png)

### Strategy Simulation

Pick two strategies (Always Cooperate, Always Defect, Tit-for-Tat, Grim Trigger, Random) and run up to 100 rounds. Watch cumulative payoffs diverge round by round and see why Tit-for-Tat outperforms Always Defect over time.

![Strategy Simulation tab](docs/screenshots/readme-sim.png)

### Game Playground

Switch between four canonical 2x2 symmetric games: Prisoner's Dilemma, Stag Hunt, Chicken (Hawk-Dove), and Coordination Game. Each comes with its own default payoffs, DeFi analogy, and equilibrium analysis. Hover the jargon terms for plain-English definitions.

![Game Playground tab](docs/screenshots/readme-playground.png)

---

## Quickstart

Requirements: Node.js 18+

```bash
npm install
npm run dev
```

Open the `localhost` URL printed in the terminal.

---

## Project structure

```
src/
  game/
    pd.ts           Core Prisoner's Dilemma engine (T/R/P/S analysis)
    strategies.ts   Iterated simulation (N rounds, 5 strategies)
    defi.ts         Pool stats -> payoff mapping formula
    games.ts        Generic 2x2 game engine (Nash, Pareto, 4 game types)
    defillama.ts    DeFiLlama API client (pool search + volatility fetch)
  components/
    PoolSearch.tsx  Live pool search UI with sliders
  App.tsx           Main UI: Hero, Pool Search, three tabs
  style.css         Layout and component styles
```

---

## How payoffs are derived from pool data

| Payoff | Formula | Intuition |
|---|---|---|
| R (both stay) | APR × horizon × (1 - IL penalty) | Earn yield, modest impermanent loss from normal vol |
| T (you exit, others stay) | R × (1 + volatility premium) | Dodge future IL while keeping past fees |
| P (everyone exits) | R × (1 - panic penalty) | Slippage + lost fees, worse with high whale concentration |
| S (you stay, others exit) | R × (1 - sucker penalty) | Stuck in drained pool, no counterparty depth |

Whale concentration amplifies P and S — when a few large LPs exit together they crater the pool price, making the bank run scenario much worse.

---

## Game theory concepts

**Payoffs (T, R, P, S)**

- T (Temptation): you defect while the other cooperates
- R (Reward): both cooperate
- P (Punishment): both defect
- S (Sucker's payoff): you cooperate while the other defects

For a strict Prisoner's Dilemma: T > R > P > S and 2R > T + S. Under these conditions, defecting is a dominant strategy for both players, so (D, D) is the unique Nash equilibrium even though (C, C) would be better for both.

**Strategies in iterated play**

| Strategy | Rule |
|---|---|
| Always Cooperate | C every round |
| Always Defect | D every round |
| Tit-for-Tat | Start C, then mirror the opponent's last move |
| Grim Trigger | Start C, switch to D forever after the first betrayal |
| Random | C or D with equal probability each round |

---

## The four game types

| Game | Nash equilibria | Key tension |
|---|---|---|
| Prisoner's Dilemma | (D, D) unique | Individual rationality beats collective welfare |
| Stag Hunt | (C, C) and (D, D) | Trust determines which equilibrium you land on |
| Chicken | (C, D) and (D, C) | Both defecting is the worst outcome; someone must yield |
| Coordination | (C, C) and (D, D) | No conflict of interest, just a coordination problem |

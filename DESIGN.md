# Design Notes

## Purpose

This version is intentionally narrow: it is a clean, inspectable implementation of the classical Prisoner's Dilemma. The idea is to make the payoff logic easy to reason about and reuse as an "engine" in other projects (e.g., DeFi simulations, agent-vs-agent labs, mechanism design playgrounds).

## Architecture

- **Game core** (`src/game/pd.ts`)
  - Pure TypeScript, no React imports.
  - Contains the payoff types, matrix construction, dominant-strategy detection, and PD classification.
  - Safe to reuse in scripts, backends, or other UIs.

- **UI layer** (`src/App.tsx`)
  - Thin React component that:
    - Holds T, R, P, S in local state.
    - Calls `analyzePD` on every change.
    - Renders the matrix and a verdict.
  - No external state management, routing, or theming; easy to drop into another app.

- **Styling** (`src/style.css`)
  - Single file with minimal but opinionated styling.
  - Dark, card-based look that fits crypto/DeFi dashboards.

## How to extend this

1. **Add agent strategies and repeated play**
   - Create `src/game/strategies.ts` with simple strategies: always-cooperate, always-defect, tit-for-tat, grim-trigger.
   - Add a function that simulates N rounds, where each round uses `analyzePD` on the same or evolving payoffs.

2. **DeFi mapping layer**
   - Define a `PoolStats` type (APR, volatility, whale share, horizon, etc.).
   - Add functions like `poolToPD(stats: PoolStats): PDPayoffs` that encode your thesis about how risk and flows change incentives.
   - Wire a basic pool selector in `App.tsx` to auto-fill T, R, P, S via `poolToPD`.

3. **Mechanism design playground**
   - Generalize `PDPayoffs` into a more generic `Game` type with players, actions, and payoff matrix.
   - Keep `analyzePD` as one specific lens, but allow other game types (stag hunt, coordination game, chicken) to be plugged in.

## UX principles

- Single-screen tool with an obvious screenshot story.
- Inputs on the left, payoff matrix + explanation on the right.
- One clear verdict line at the bottom for sharing.

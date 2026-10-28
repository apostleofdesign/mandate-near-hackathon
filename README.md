# Mandate

A policy-governed agent marketplace on NEAR. Built for **NEAR HACKATHON** (Build Beyond Boundaries, 1–14 Nov 2026).

Tracks: **Agent Economy** (`agents`) · **AI Security & Defense** (`security`) · **AI Swarms** (`swarms`) · **Autonomous Business** (`business`)

## The problem

Giving an AI agent a crypto wallet means giving it a private key — full, unbounded authority. There's no way today for a human (or another agent) to hand an agent *some* money with *some* limits and get that authority back automatically if something looks wrong. Every "AI agent with a wallet" demo either has no real spending power, or has all of it.

## What we built

**Mandate** is a revocable, policy-bounded spending permission, plus a marketplace that uses it:

- **`contracts/mandate`** — a registry contract. Issuing a mandate gives an agent a daily spend cap, an optional allow-list of contracts it can pay, and an optional expiry. Every spend is checked and recorded on-chain before it's allowed to proceed. A separate `guard` account — independent of whoever issued the mandate — can force-revoke it at any time.
- **`contracts/task-market`** — a bounty board. A requester posts a task with a budget attached; agents bid under that budget; the requester assigns a winner; the winner delivers a result hash; accepting it pays the winning bid immediately.
- **`agents/`** — three small agents that use both contracts together:
  - `coordinator.ts` holds a mandate funded by a human, splits a bounty into subtasks, and *sub-bounties* each piece to specialist agents from its own mandate-capped treasury — delegation that composes.
  - `worker.ts` watches the task market, bids on work it can do, and delivers.
  - `guard.ts` watches spend velocity across all mandates and revokes the ones that look wrong — the kill switch a human doesn't have to pull by hand.
- **`app/`** — a Next.js dashboard: connect a wallet, see mandates and their live spend-vs-cap, see open tasks and their bids.

How NEAR fits: mandates are built on NEAR's native **function-call access keys and sub-accounts** (the same primitives, formalized as an explicit on-chain policy object instead of an opaque key); settlement is native NEAR transfers today, with **NEAR Intents** as the funding path (fund the whole swarm's treasury from any chain/asset in one step) and **Chain Signatures** as the stretch goal (let a mandate-holding agent settle directly on another chain without bridging).

## Status

This is the hackathon scaffold: both contracts implement the full policy/market logic described above and are ready to build and deploy; the dashboard and the three agent scripts are wired up to the contract interfaces with the remaining LLM/indexer calls marked `TODO`. See [`docs/architecture.md`](docs/architecture.md) for the full design and what's left for each piece.

## Run it

**1 — Build the contracts.** See them compile and produce wasm artifacts.

```bash
cd contracts
rustup target add wasm32-unknown-unknown
./build.sh
```
Expected result: `contracts/../out/mandate.wasm` and `out/task_market.wasm` exist.

**2 — Deploy to testnet dev accounts.** See both contracts live on-chain.

```bash
near create-account mandate-dev.<your-account>.testnet --useFaucet
near deploy mandate-dev.<your-account>.testnet out/mandate.wasm --initFunction new --initArgs '{"guard":"guard-dev.<your-account>.testnet"}'

near create-account market-dev.<your-account>.testnet --useFaucet
near deploy market-dev.<your-account>.testnet out/task_market.wasm --initFunction new --initArgs '{}'
```
Expected result: `near state <contract>.testnet` shows deployed code for both accounts.

**3 — Run the dashboard.** See the connected wallet and both contract ids render.

```bash
cd app
npm install
NEXT_PUBLIC_NEAR_NETWORK=testnet \
NEXT_PUBLIC_MANDATE_CONTRACT_ID=mandate-dev.<your-account>.testnet \
NEXT_PUBLIC_TASK_MARKET_CONTRACT_ID=market-dev.<your-account>.testnet \
npm run dev
```
Expected result: `localhost:3000` shows both contract ids and a "Connect wallet" button.

**4 — Run an agent.** See a worker log a stubbed bid.

```bash
cd agents
npm install
NEAR_WORKER_ACCOUNT=<your-account>.testnet WORKER_SKILL=research npm run worker
```
Expected result: a log line showing a worker watching the task market and a stubbed delivery hash.

## Disclosure (per `HACKATHON.md` Q-005 / Q-017)

- Repository created fresh for this hackathon; all code written from 28 Oct 2026 onward, inside the eligible window that opened with the announcement on 19 Oct 2026.
- Built with AI pair-programming (Claude Code) for contract and scaffold code; architecture, track strategy and all design decisions directed by the team.
- No pre-existing libraries or templates beyond standard `near-sdk`, `near-api-js`, and `next` scaffolding.
- No NEAR Intents testnet exists (per Q-007) — Intents funding path will be tested on mainnet with a separate dev account and `dry: true` quotes before any real transfer.

## License

MIT — see [`LICENSE`](LICENSE).

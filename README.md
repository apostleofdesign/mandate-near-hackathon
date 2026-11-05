# Mandate

A capped, revocable, allow-listed spending permission for AI agents — instead of a raw private key. Built for **NEAR HACKATHON** (Build Beyond Boundaries, 1–14 Nov 2026).

Mandate is infrastructure, not one app's feature. This repo ships three independent surfaces built on the same permission contract:

- **Hire a Swarm** (`/swarm`) — the flagship: post a job, worker agents bid, you assign and settle on-chain.
- **Developers** (`/developers`) — the integration guide: how any NEAR app gates spending through Mandate in two calls.
- **Checkout** (`/store`) — a universal checkout widget, a second working surface proving the same permission isn't tied to one use case.

Tracks: **Agent Economy** (`agents`) · **AI Swarms** (`swarms`) · **AI Security & Defense** (`security`) · fits **Autonomous Business** (`business`) and **Real-World Money** (`realworld`) via Checkout

## The problem

1. Giving an AI agent a wallet means giving it a real private key: unbounded authority, with no way to cap or revoke it short of cutting the key entirely.
2. Every judge we could find public statements from raised a version of this independently, unprompted: Avichal Garg (Electric Capital) publicly asked, on a NEARCON panel, who holds the keys once agents have wallets; Mert Mumtaz (Helius) said agent payments are pointless unless they do something a Stripe integration structurally can't; Haseeb Qureshi (Dragonfly) said he wouldn't trust an agent with his own portfolio at current reliability.
3. "Agents that can hire other agents" is one of the hackathon's own named tracks, and Illia Polosukhin (NEAR co-founder, a judge) separately posted wanting a swarm-for-hire with exactly this kind of guardrail.

## What we built

- **`contracts/mandate`** — the permission primitive. Daily cap, optional contract allow-list, optional expiry, every spend checked and recorded on-chain before it's allowed to proceed. A `guard` account independent of whoever issued the mandate can force-revoke it the instant spend velocity looks wrong. `list_mandates` pages through every mandate issued, for the dashboard and the Guard watcher.
- **`contracts/task-market`** — the swarm marketplace. A requester posts a bounty with a budget attached; agents bid; the requester assigns a winner; the winner delivers a result hash; accepting it pays the winning bid immediately. `list_tasks` pages through the whole board.
- **`app/app/swarm`** — **Hire a Swarm**, the marketplace UI over Task Market: post a job, watch bids come in, assign, accept & settle — every action a real contract call.
- **`app/app/developers`** — **Build on Mandate**, the dev-tools page: the exact two-call pattern (`authorize_spend` then your own contract call) with TypeScript and near-cli snippets, and a reference table of every Mandate method.
- **`agents/src/{worker,coordinator,guard}.ts`** — real, wired agents, not stubs: a worker polls the board, bids on tasks matching its skill, and delivers; a coordinator holds its own mandate and sub-bounties a decomposed job to workers from its own capped treasury; a guard polls every mandate's spend velocity and revokes the ones that look wrong. Only the work product itself (`runWork` in `worker.ts`) is a deterministic stub, left that way so the demo doesn't need an LLM API key to run end to end.
- **`contracts/checkout`**, **`app/components/CheckoutWidget.tsx`**, **`app/app/store`**, **`agents/src/shopping-agent.ts`** — the second working surface: a universal checkout widget (any merchant, any customer wallet/chain via NEAR Intents) gated by the exact same Mandate, demoed by an AI shopping agent buying a real product end to end.

How NEAR fits: settlement on both surfaces is native NEAR transfers, gated by `mandate.authorize_spend` before the surface's own contract call ever runs; Checkout additionally uses **NEAR Intents** to land a customer's funds in NEAR from any chain/wallet first (`app/lib/intents.ts`); mandates formalize NEAR's native **function-call access key** idea into an explicit, inspectable, revocable policy object instead of an opaque key.

## Why this, specifically

Mandate is deliberately not married to one app. `contracts/checkout` and `contracts/task-market` are independent contracts that never call each other — both just call `mandate.authorize_spend` before their own logic runs, the same two-step pattern documented on `/developers`. That decoupling is the actual pitch: it's what lets a swarm marketplace and a checkout widget both exist on the same permission contract without one knowing the other exists, and it's what any third NEAR app would plug into the same way. Hire a Swarm is the flagship because "agents that hire other agents" is a named track and the clearest demo of agents actually transacting, not just chatting — but the dev-tools page exists specifically to make the point explicit: this is reusable infrastructure, not a one-off feature of either app built on it.

## Status

- `contracts/mandate` and `contracts/task-market` — full logic including `list_mandates`/`list_tasks` pagination, ready to build and deploy.
- `agents/src/worker.ts`, `coordinator.ts`, `guard.ts` — real polling loops and real contract calls end to end; only the LLM work product is stubbed.
- `app/app/swarm` and `app/app/developers` — real, wired UI; typechecked and production-built clean.
- `contracts/checkout`, `CheckoutWidget.tsx`, `agents/src/shopping-agent.ts` — still fully real for the NEAR-direct path (see prior iteration); the cross-chain-via-Intents branch in `app/lib/intents.ts` still needs its endpoint/schema verified against `docs.near-intents.org`.

## Run it

**1 — Build the contracts.** See them compile and produce wasm artifacts.

```bash
cd contracts
rustup target add wasm32-unknown-unknown
./build.sh
```
Expected result: `out/mandate.wasm`, `out/task_market.wasm`, and `out/checkout.wasm` all exist.

**2 — Deploy Mandate and Task Market to testnet dev accounts.**

```bash
near create-account guard-dev.<you>.testnet --useFaucet
near create-account mandate-dev.<you>.testnet --useFaucet
near deploy mandate-dev.<you>.testnet out/mandate.wasm --initFunction new --initArgs '{"guard":"guard-dev.<you>.testnet"}'

near create-account market-dev.<you>.testnet --useFaucet
near deploy market-dev.<you>.testnet out/task_market.wasm --initFunction new --initArgs '{}'
```
Expected result: `near state <contract>.testnet` shows deployed code for both.

**3 — Run the dashboard and Hire a Swarm.**

```bash
cd app
npm install
NEXT_PUBLIC_NEAR_NETWORK=testnet \
NEXT_PUBLIC_MANDATE_CONTRACT_ID=mandate-dev.<you>.testnet \
NEXT_PUBLIC_TASK_MARKET_CONTRACT_ID=market-dev.<you>.testnet \
npm run dev
```
Expected result: `localhost:3000/swarm` loads the board (empty at first); connect a testnet wallet, post a job under "Post a job" — the board shows it under "Board" with a real on-chain task id.

**4 — Hire a worker agent.** See a real bid land on your job.

```bash
near create-account researcher.mandate.testnet --useFaucet
cd agents
npm install
NEAR_WORKER_ACCOUNT=researcher.mandate.testnet \
TASK_MARKET_CONTRACT_ID=market-dev.<you>.testnet \
WORKER_SKILL=research \
npm run worker
```
Expected result: within one poll interval, the worker logs a bid and it appears on the job's card in `/swarm`. Click "Assign" on that bid (as the job's poster); within the next poll the worker logs a delivery; click "Accept & settle" to pay it — `get_task` now shows `Settled`.

**5 — Run the Guard and watch it fail a mandate closed.**

```bash
near call mandate-dev.<you>.testnet issue_mandate \
  '{"owner":"coordinator.mandate.testnet","daily_cap":"500000000000000000000000","allowed_contracts":["market-dev.<you>.testnet"],"expires_at":0}' \
  --accountId <you>.testnet

NEAR_GUARD_ACCOUNT=guard-dev.<you>.testnet MANDATE_CONTRACT_ID=mandate-dev.<you>.testnet npm run guard
# in another shell, try to post a sub-bounty that exceeds the tiny cap above:
NEAR_COORDINATOR_ACCOUNT=coordinator.mandate.testnet \
MANDATE_CONTRACT_ID=mandate-dev.<you>.testnet \
TASK_MARKET_CONTRACT_ID=market-dev.<you>.testnet \
MANDATE_ID=<the id just issued> \
npm run coordinator "a one-page market brief"
```
Expected result: `authorize_spend` panics with `daily cap exceeded` on the first subtask that doesn't fit — the script exits non-zero before a second sub-bounty is ever posted.

**6 — Checkout, the second surface.** See [`docs/architecture.md`](docs/architecture.md) for the Checkout-specific deploy steps — same pattern, `contracts/checkout` instead of `task-market`.

## Disclosure (per `HACKATHON.md` Q-005 / Q-017)

- All code written from 28 Oct 2026 onward, inside the eligible window that opened with the announcement on 19 Oct 2026. Direction was revised twice since: to Checkout on 5 Nov after reading the hackathon judges' public statements, then to Hire a Swarm plus the dev-tools page the same week — Task Market and the agent scripts already existed from the first iteration; what changed is which surface leads and that the agents are real instead of stubbed.
- Built with AI pair-programming (Claude Code) for contract and scaffold code and for the judge research that shaped the direction; architecture, track strategy and all design decisions directed by the team.
- No pre-existing libraries or templates beyond standard `near-sdk`, `near-api-js`, and `next`/`shadcn` scaffolding.
- No NEAR Intents testnet exists (per Q-007) — Checkout's cross-chain path will be tested on mainnet with a separate dev account and `dry: true` quotes before any real transfer.

## License

MIT — see [`LICENSE`](LICENSE).

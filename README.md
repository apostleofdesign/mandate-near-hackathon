# Mandate

A capped, revocable, allow-listed spending permission for AI agents — instead of a raw private key. Built for **NEAR HACKATHON** (Build Beyond Boundaries, 1–14 Nov 2026).

Mandate is infrastructure, not one app's feature. This repo ships two surfaces built on the same permission contract:

- **Hire a Swarm** (`/swarm`) — the flagship: post a job, worker agents bid, you assign and settle on-chain.
- **Developers** (`/developers`) — the integration guide: how any NEAR app gates spending through Mandate in two calls.

Tracks: **AI Security & Defense** (`security`, primary) · **Agent Economy** (`agents`) · **AI Swarms** (`swarms`)

**Try it live, no setup:** [mandate-near-hackathon.vercel.app](https://mandate-near-hackathon.vercel.app) — connect a testnet wallet and use Hire a Swarm for real.

## Live on testnet

Both contracts are deployed and the full loop has run for real — not simulated.

- `mandate-f70187.testnet` — [view on explorer](https://explorer.testnet.near.org/accounts/mandate-f70187.testnet)
- `market-f70187.testnet` — [view on explorer](https://explorer.testnet.near.org/accounts/market-f70187.testnet)
- Mandate `#0`: issued to `owner-f70187.testnet`, 0.5 NEAR daily cap, allow-listed to the market contract. Backed task `#0` (0.1 NEAR budget, "research: summarize NEAR AI Cloud pricing") end to end: `researcher-f70187.testnet` bid 0.08 NEAR, was assigned, delivered a real sha256-hashed work product, and got paid on `accept_and_settle` — [transaction](https://explorer.testnet.near.org/transactions/4QpQZgwmVRkhG1E8Jh6aziCUE85hL9ijrsgDG7h5ouHR).
- Mandate `#1`: issued with a 1.5 NEAR cap to prove the cap has teeth. The coordinator agent posted one 1 NEAR sub-bounty (`authorize_spend` succeeded, mandate sat at 66% of cap), then its *second* `authorize_spend` call for another 1 NEAR panicked with `daily cap exceeded` and the coordinator exited non-zero before a second sub-bounty was ever posted.
- **The Guard has actually force-revoked a live mandate — not simulated.** Mandate `#2` was issued fresh (0.4 NEAR cap, owner `researcher-f70187.testnet`) with the Guard watcher already running against the live contract. `researcher-f70187.testnet` then called `authorize_spend` for 0.3 NEAR — 75% of the cap in one call — and the Guard revoked it on its very next poll, a few seconds later, independently of the mandate's own issuer: [issue tx](https://explorer.testnet.near.org/transactions/A5iujBdzmajnZR3XMnbMTw6rGMvu5nbVkVx5EiKaGSev) → [revoke tx](https://explorer.testnet.near.org/transactions/G9KJkEyjQXwp46oWiHAJcz7i3iCeiT4sLxXabD8MYMaJ). `get_mandate({"id":2})` now shows `"revoked":true`. (Mandate `#1`'s pre-existing 66%-of-cap spend tripped the same Guard check independently, the instant the watcher started — a second, unplanned confirmation of the same code path.)
- **`task-market` now has a real refund path — no stranded funds.** `cancel_task` refunds an unassigned task's full budget to the requester, and `accept_and_settle` now returns any unspent remainder (budget minus the winning bid) to the requester in the same transaction. Exercised live: task `#1` (1 NEAR budget, never bid on) was cancelled and its full budget returned to `owner-f70187.testnet` — [transaction](https://explorer.testnet.near.org/transactions/9cqdQA6GaqcpnRAVt3aZLw5x1TAZwYMGyf3q8wpa4G7n).
- **The guard is now rotatable — and that's been exercised live too.** `mandate-f70187.testnet` was migrated in place (every existing mandate carried over byte-for-byte, verified before and after) to add an `owner` role (`owner-f70187.testnet`) that can call `set_guard` — [migration tx](https://explorer.testnet.near.org/transactions/oXBXUaeWPiMwr2hwbadeK5876P91X1Dpi1pM3uKs4n6). Then, for real: the guard was rotated to a different account, the *old* guard key's `revoke` call was tried and failed on-chain — [failed tx, as proof](https://explorer.testnet.near.org/transactions/PpQSxzNW3jJxnDcU7ZY4srnPM7TpdmhiJbsirw8Akef) — and the guard was rotated back. `get_guard` confirms `guard-f70187.testnet` is in control again.
- **A real tester's run broke `accept_and_settle` — fixed, and re-verified live.** NEAR's protocol rejects a function that returns a joined `Promise` (`a.and(b)`) directly; `accept_and_settle` did exactly that whenever a job had a remainder to refund, and failed every time with no useful error beyond "there was an error" in the wallet. Fixed by not returning the joined promise — the transfers still schedule regardless. `task-market` now also stores the assignee's actual delivered content on-chain (`delivery_content`), not just a hash of it, and the hash is computed on-chain from that content instead of trusted from the caller. Migrating that shape change live surfaced a second, subtler bug — `LookupMap::insert` deserializes the *old* value as the *new* type to return it, which panics against old-shape bytes — fixed by migrating through raw `storage_read`/`storage_write` instead. All verified against the live contract: task `#4` was posted, bid on, assigned, delivered with real content, and the stored `delivery_hash` matches a local `sha256` of that content exactly.
- **`bid` now rejects a second bid from the same account — closing a real duplicate-bid bug found running 5 worker agents 24/7.** A client-side transaction-layer nonce retry (near-api-js resubmitting a call whose original confirmation was delayed) could land the *same* logical bid twice, since nothing on-chain stopped it — observed live as the same agent appearing twice in a task's bid list. `bid` now asserts the predecessor hasn't already bid on that task, so a resubmitted bid fails cleanly instead of duplicating. Exercised live post-fix: a fresh task got exactly one bid per agent, no duplicates, across several repeats. (The worker agents also no longer crash the whole process over a single rejected transaction — a failed bid or delivery is logged and rechecked on the next poll instead of taking the agent down.)

## The problem

1. Giving an AI agent a wallet means giving it a real private key: unbounded authority, with no way to cap or revoke it short of cutting the key entirely.
2. Every judge we could find public statements from raised a version of this independently, unprompted: Avichal Garg (Electric Capital) publicly asked, on a NEARCON panel, who holds the keys once agents have wallets; Mert Mumtaz (Helius) said agent payments are pointless unless they do something a Stripe integration structurally can't; Haseeb Qureshi (Dragonfly) said he wouldn't trust an agent with his own portfolio at current reliability.
3. "Agents that can hire other agents" is one of the hackathon's own named tracks, and Illia Polosukhin (NEAR co-founder, a judge) separately posted wanting a swarm-for-hire with exactly this kind of guardrail.

## What we built

- **`contracts/mandate`** — the permission primitive. Daily cap, optional contract allow-list, optional expiry, every spend checked and recorded on-chain before it's allowed to proceed. A `guard` account independent of whoever issued the mandate can force-revoke it the instant spend velocity looks wrong. `list_mandates` pages through every mandate issued, for the dashboard and the Guard watcher.
- **`contracts/task-market`** — the swarm marketplace. A requester posts a bounty with a budget attached; agents bid; the requester assigns a winner; the winner delivers a result hash; accepting it pays the winning bid and refunds any unspent remainder in the same transaction. `cancel_task` refunds the full budget of a task nobody's been assigned to yet. `list_tasks` pages through the whole board.
- **`app/app/swarm`** — **Hire a Swarm**, the marketplace UI over Task Market: post a job, watch bids come in, assign, accept & settle — every action a real contract call.
- **`app/app/page.tsx`** — doubles as the Mandate dashboard: every mandate's live spend vs. daily cap, read straight from `list_mandates`, no indexer.
- **`app/app/developers`** — **Build on Mandate**, the dev-tools page: the exact two-call pattern (`authorize_spend` then your own contract call) with TypeScript and near-cli snippets, and a reference table of every Mandate method.
- **`agents/src/{worker,coordinator,guard}.ts`** — real, wired agents, not stubs: a worker polls the board, bids on tasks matching its skill, and delivers; a coordinator holds its own mandate and sub-bounties a decomposed job to workers from its own capped treasury; a guard polls every mandate's spend velocity and revokes the ones that look wrong. The worker's actual work product comes from a real **Gemini** inference call (see below) — not a canned string.

How NEAR fits: settlement is native NEAR transfers, gated by `mandate.authorize_spend` before Task Market's own logic ever runs; mandates formalize NEAR's native **function-call access key** idea into an explicit, inspectable, revocable policy object instead of an opaque key. Workers get paid in real NEAR the moment a job settles — the inference call that produces the work itself runs on Gemini, separate from that on-chain payout.

## Why Gemini

The worker agent needs a real LLM call to produce the work it delivers. Gemini's API is OpenAI-SDK-compatible (`generativelanguage.googleapis.com/v1beta/openai/`) — the exact same `openai` npm package `agents/src/llm.ts` already used, swapped to a different base URL and key — and the free tier needs no billing setup, which matters for a demo other people will actually run. `agents/src/llm.ts` falls back to a deterministic stub whenever `GEMINI_API_KEY` isn't set, so the bid/assign/deliver/settle loop stays demoable either way; the real call is what runs when it's configured.

## Why this, specifically

Mandate is deliberately not married to one app. `contracts/task-market` is an independent contract — it never calls into Mandate beyond one `authorize_spend` check before its own logic runs, the pattern documented on `/developers`. That decoupling is the actual pitch: a swarm marketplace can sit on this permission contract without needing to know anything else about it, and any third NEAR app would plug in the exact same way. Hire a Swarm is the flagship because "agents that hire other agents" is a named track and the clearest demo of agents actually transacting, not just chatting — but the dev-tools page exists specifically to make the point explicit: this is reusable infrastructure, not a one-off feature.

## Known limitations

Said plainly, because the Security track is the primary claim here and an undisclosed gap is worse than a disclosed one:

- **`authorize_spend` and the real spend it gates aren't atomically linked.** The pattern on `/developers` is two separate calls — `authorize_spend` then your own contract call — enforced by the *caller's* control flow (a client that doesn't proceed past a panic), not by anything on-chain joining them into one transaction. Mandate records what a caller *reports* spending; it has no way to confirm a transfer of that exact amount to that exact target actually followed. A faithful caller (Task Market, the agents in this repo) is bound by it in practice; nothing but that cooperation enforces it on-chain. Closing this fully means redesigning Mandate to hold and move funds itself rather than stay a pure policy registry — a different architecture than what's shipped here, and risky to attempt this close to the deadline. (The `guard`-rotation gap that used to be listed here has been fixed — see "Live on testnet" above.)

Everything else — the cap, the allow-list, the day rollover, who can revoke, the task-market state machine, overflow handling — was re-audited line by line, including a byte-for-byte check that the deployed testnet wasm matches this source exactly. No other gaps found.

## Status

- `contracts/mandate` and `contracts/task-market` — full logic including `list_mandates`/`list_tasks` pagination, `cancel_task`, the settlement remainder refund, a rotatable `guard` (`set_guard`, owner-gated), and `deliver` storing the real work product on-chain (hashed there, not by the caller); 23 unit tests (`cargo test`) cover the cap, allow-list, revoke-authorization, guard-rotation, and status-transition rules. Ready to build and deploy.
- `agents/src/worker.ts`, `coordinator.ts`, `guard.ts` — real polling loops and real contract calls end to end. `worker.ts`'s work product is a real Gemini chat completion when `GEMINI_API_KEY` is set, a deterministic stub otherwise, and is now stored on-chain in full rather than just as a hash.
- `app/app/swarm`, `app/app/developers`, and the Mandates panel on `app/app/page.tsx` — real, wired UI; typechecked and production-built clean.

## Run it

**1 — Build and test the contracts.** See them compile, pass their unit tests, and produce wasm artifacts.

```bash
cd contracts
rustup target add wasm32-unknown-unknown
cargo test
./build.sh
```
Expected result: `cargo test` reports `23 passed; 0 failed` across both crates; `out/mandate.wasm` and `out/task_market.wasm` both exist.

**2 — Deploy Mandate and Task Market to testnet dev accounts.**

```bash
near create-account guard-dev.<you>.testnet --useFaucet
near create-account mandate-dev.<you>.testnet --useFaucet
near deploy mandate-dev.<you>.testnet out/mandate.wasm --initFunction new --initArgs '{"guard":"guard-dev.<you>.testnet","owner":"<you>.testnet"}'

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
Expected result: `localhost:3000` shows the Mandates panel (empty at first); `/swarm` loads the board. Connect a testnet wallet and post a job under "Post a job" — it appears under "Board" with a real on-chain task id.

**4 — Hire a worker agent.** See a real bid land on your job, backed by a real LLM call.

```bash
near create-account researcher.mandate.testnet --useFaucet
cd agents
npm install
NEAR_WORKER_ACCOUNT=researcher.mandate.testnet \
TASK_MARKET_CONTRACT_ID=market-dev.<you>.testnet \
WORKER_SKILL=research \
GEMINI_API_KEY=<your free key from aistudio.google.com/apikey> \
npm run worker
```
Expected result: within one poll interval, the worker logs a bid and it appears on the job's card at `localhost:3000/swarm`. Click "Assign" on that bid (as the job's poster); within the next poll the worker calls Gemini for the actual deliverable, stores it on-chain, and logs a delivery — the delivered text is now readable right on the job's card, not just a hash. Click "Accept & settle" to pay it — `get_task` now shows `Settled`. Omit `GEMINI_API_KEY` to see the same flow run on the deterministic stub instead.

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
Expected result: `authorize_spend` panics with `daily cap exceeded` on the first subtask that doesn't fit — the script exits non-zero before a second sub-bounty is ever posted. The dashboard's Mandates panel shows that mandate's bar at (or near) 100%. Separately, if the Guard is already running (`npm run guard`) when a mandate's spend jumps past the velocity threshold in one call, it force-revokes that mandate on its next poll — this has been exercised for real against the live deployment above, independent of this reproduction path.

## Keeping the swarm alive for judges

The 5 worker personas (`researcher`, `writer`, `analyst`, `critic`, `summarizer`) need to actually be running for a judge visiting the live site to see a bid land, not just the contracts being deployed. `agents/src/run-all-workers.ts` runs all 5 as one long-lived process — each is a child of a small supervisor that respawns it within 5 seconds if it ever crashes — so one free-tier host (Railway, Render, Fly.io) keeps the whole board live 24/7 instead of depending on a laptop staying on.

**Deploy (Railway, or any host that builds `agents/Dockerfile` and runs `npm start`):**
1. New project → deploy from this GitHub repo, with the service's root directory set to `agents`.
2. Set these environment variables on the service:
   - `GEMINI_API_KEY` — the same key used locally.
   - `RESEARCHER_PRIVATE_KEY`, `WRITER_PRIVATE_KEY`, `ANALYST_PRIVATE_KEY`, `CRITIC_PRIVATE_KEY`, `SUMMARIZER_PRIVATE_KEY` — each is the `private_key` field from that persona's local `~/.near-credentials/testnet/<persona>-f70187.testnet.json` file (e.g. `researcher-f70187.testnet.json` → `RESEARCHER_PRIVATE_KEY`). Copy these from your own machine directly into the host's dashboard — never commit them to the repo.
3. Deploy. Logs should show `[supervisor] starting 5 worker personas against market-f70187.testnet` followed by each persona logging `watching market-f70187.testnet`.

`agents/src/near-client.ts` picks up a `NEAR_WORKER_PRIVATE_KEY` env var when present (used internally by the supervisor) and falls back to the local `~/.near-credentials` file store otherwise — so the same code runs unchanged locally and on a host with no file store.

## Disclosure (per `HACKATHON.md` Q-005 / Q-017)

- All code written from 28 Oct 2026 onward, inside the eligible window that opened with the announcement on 19 Oct 2026. Direction was revised twice since: briefly to a universal checkout, then to Hire a Swarm plus the dev-tools page after reading the hackathon judges' public statements — the checkout surface was removed from this repo once Hire a Swarm became the flagship, to keep the submission focused on one well-built surface instead of two half-finished ones.
- Built with AI pair-programming (Claude Code) for contract and scaffold code and for the judge/API research that shaped the direction; architecture, track strategy and all design decisions directed by the team.
- No pre-existing libraries or templates beyond standard `near-sdk`, `near-api-js`, `openai`, and `next`/`shadcn` scaffolding.
- Gemini's OpenAI-compatible endpoint is documented at `ai.google.dev/gemini-api/docs/openai` — base URL `https://generativelanguage.googleapis.com/v1beta/openai/`, `Authorization: Bearer <key>`. `agents/src/llm.ts` falls back to a deterministic stub when `GEMINI_API_KEY` isn't set, so the demo never depends on the key being present.

## License

MIT — see [`LICENSE`](LICENSE).

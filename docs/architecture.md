# Architecture

## The swarm flow (the flagship)

```
  human / coordinator agent
         |
         |  authorize_spend(mandate_id, task_market, budget)   <-- fails closed:
         v                                                          revoked / expired /
  MANDATE registry  -------------------------------------------      over cap / not
         |  (panics = nothing below runs)                            allow-listed
         v
  TASK MARKET.post_task(spec)  [budget attached]
         |
         v
  worker agents poll list_tasks, bid on matches
         |
         v
  requester calls assign(task_id, winning_bidder)
         |
         v
  assigned worker calls NEAR AI Cloud for the real deliverable,
  calls deliver(task_id, hash)
         |
         v
  requester calls accept_and_settle(task_id)  -> pays the winning bid
```

In parallel, the **Guard** watcher polls `list_mandates` and calls `revoke(id)` the instant a mandate's spend velocity looks wrong — independent of whoever issued it.

## Why Mandate and Task Market are separate contracts

They don't call each other. **Mandate** is a general-purpose policy primitive that doesn't know about tasks, bids, or deliveries. **Task Market** is one *consumer* of it — it just calls `mandate.authorize_spend` before its own logic runs, the pattern documented on `/developers`. This is deliberate, not incidental: it's the proof that Mandate is reusable infrastructure rather than something built into one app. A second NEAR app (payroll, a DAO budget, anything) would integrate the exact same way, without Mandate needing to change and without touching Task Market.

## The two frontend surfaces

| Surface | Route | Built on | Role |
| --- | --- | --- | --- |
| Hire a Swarm | `/swarm` | `task-market` | Flagship — post a job, bids come in, assign, settle. |
| Developers | `/developers` | (docs only) | The integration guide — proves Mandate is infra, not a feature. |
| Dashboard | `/` | `mandate` | Every mandate's live spend vs. cap, via `list_mandates`. |

## The NEAR AI Cloud call

`agents/src/llm.ts` wraps the `openai` npm SDK pointed at NEAR AI Cloud's OpenAI-compatible gateway:

```ts
const client = new OpenAI({ baseURL: "https://cloud-api.near.ai/v1", apiKey: process.env.NEAR_AI_API_KEY });
const completion = await client.chat.completions.create({
  model: "zai-org/GLM-5.1-FP8",
  messages: [{ role: "user", content: spec }],
});
```

`worker.ts` calls this to produce the actual delivered content for a task, then hashes the result for `deliver`. If `NEAR_AI_API_KEY` isn't set, `llm.ts` returns a deterministic stub string instead of throwing — the whole bid/assign/deliver/settle loop still runs and is still demoable, just without a real model behind the output. This matters because NEAR AI Cloud's public API has no published rate limit or SLA (16-star GitHub repo at the time of writing) — a hackathon demo video can't depend on it staying up.

## What's real vs. what's a stub

| Piece | State |
| --- | --- |
| `contracts/mandate` | Full logic: issue, authorize, revoke, day-rollover, `list_mandates` pagination. Ready to build/deploy. |
| `contracts/task-market` | Full logic: post/bid/assign/deliver/settle, `cancel_task` (refunds an unassigned budget) and a remainder refund on settle, `list_tasks` pagination. Deployed live. |
| `agents/src/llm.ts` | Real NEAR AI Cloud call when `NEAR_AI_API_KEY` is set; deterministic stub otherwise. |
| `agents/src/worker.ts` | Real polling loop: bids on matching open tasks, calls `llm.ts` for the deliverable, delivers. |
| `agents/src/coordinator.ts` | Real: `authorize_spend` then `post_task` per subtask, on-chain. The subtask split itself (`decompose`) is deterministic on purpose, for a reproducible demo without depending on another LLM call. |
| `agents/src/guard.ts` | Real polling loop: `list_mandates`, flags velocity, calls `revoke`. |
| `app/app/swarm` | Real: post a job, view the board, assign a bid, accept & settle — all live contract calls. |
| `app/app/page.tsx` | Real: live spend-vs-cap bars per mandate, from `list_mandates`. |
| `app/app/developers` | Real content, no chain calls — a static integration guide, accurate to the actual contract methods. |

## Priority order for the remaining build days

1. ~~Deploy `mandate` and `task-market` to testnet; confirm the full README "Run it" sequence reproduces, including a worker actually winning a job, calling NEAR AI Cloud, and getting paid.~~ Done — see "Live on testnet" in the README.
2. ~~Confirm the Guard fail-closed demo (README step 5) actually revokes mid-flow, and that the dashboard's spend bar reflects it.~~ Done, for real, against the live deployment: mandate `#2` was issued, spent to 75% of its cap in one call while the Guard watcher was already running, and the Guard revoked it on its very next poll — [issue tx](https://explorer.testnet.near.org/transactions/A5iujBdzmajnZR3XMnbMTw6rGMvu5nbVkVx5EiKaGSev), [revoke tx](https://explorer.testnet.near.org/transactions/G9KJkEyjQXwp46oWiHAJcz7i3iCeiT4sLxXabD8MYMaJ). Mandate `#1`'s pre-existing 66%-of-cap spend also tripped the Guard the instant the watcher started, independently confirming the same path.
3. Record the demo video: post a job on `/swarm`, a worker bids and gets assigned, it delivers a real model output, accept & settle pays it, then show the Guard killing a mandate and `/developers` making the reuse case.
4. Stretch, only with days to spare: let the coordinator's `decompose` call NEAR AI Cloud too, instead of staying deterministic.

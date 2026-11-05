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
  assigned worker does the work, calls deliver(task_id, hash)
         |
         v
  requester calls accept_and_settle(task_id)  -> pays the winning bid
```

In parallel, the **Guard** watcher polls `list_mandates` and calls `revoke(id)` the instant a mandate's spend velocity looks wrong — independent of whoever issued it, and independent of whichever surface (Hire a Swarm or Checkout) was spending through it.

## Why Mandate, Task Market, and Checkout are three separate contracts

None of them call each other. **Mandate** is a general-purpose policy primitive that doesn't know about tasks, bids, orders, or merchants. **Task Market** and **Checkout** are two independent *consumers* of it — each just calls `mandate.authorize_spend` before its own logic runs, the pattern documented on `/developers`. This is deliberate, not incidental: it's the proof that Mandate is reusable infrastructure rather than something built into one app. A third NEAR app (payroll, a DAO budget, anything) would integrate the exact same way, without Mandate needing to change and without touching either existing contract.

## The three frontend surfaces

| Surface | Route | Built on | Role |
| --- | --- | --- | --- |
| Hire a Swarm | `/swarm` | `task-market` | Flagship — post a job, bids come in, assign, settle. |
| Developers | `/developers` | (docs only) | The integration guide — proves Mandate is infra, not a feature. |
| Checkout | `/store` | `checkout` | Second working surface — same permission, different consumer. |

## What's real vs. what's a stub

| Piece | State |
| --- | --- |
| `contracts/mandate` | Full logic: issue, authorize, revoke, day-rollover, `list_mandates` pagination. Ready to build/deploy. |
| `contracts/task-market` | Full logic: post/bid/assign/deliver/settle, `list_tasks` pagination. Ready to build/deploy. |
| `agents/src/worker.ts` | Real polling loop: bids on matching open tasks, delivers once assigned. Only `runWork` (the actual work product) is a deterministic stub — swap in a real LLM call to make it dynamic. |
| `agents/src/coordinator.ts` | Real: `authorize_spend` then `post_task` per subtask, on-chain. The subtask split itself (`decompose`) is deterministic on purpose, for a reproducible demo without an API key. |
| `agents/src/guard.ts` | Real polling loop: `list_mandates`, flags velocity, calls `revoke`. |
| `app/app/swarm` | Real: post a job, view the board, assign a bid, accept & settle — all live contract calls. |
| `app/app/developers` | Real content, no chain calls — a static integration guide, accurate to the actual contract methods. |
| `contracts/checkout`, `CheckoutWidget.tsx`, `agents/src/shopping-agent.ts` | Real for the NEAR-direct path (see git history for the Checkout iteration). The cross-chain-via-Intents branch in `app/lib/intents.ts` calls a best-effort client against an unverified endpoint shape. |

## Checkout deploy (for README step 6)

```bash
near create-account checkout-dev.<you>.testnet --useFaucet
near deploy checkout-dev.<you>.testnet out/checkout.wasm --initFunction new --initArgs '{}'

near create-account merchant-dev.<you>.testnet --useFaucet
near call checkout-dev.<you>.testnet register_merchant '{"label":"Demo Store"}' --accountId merchant-dev.<you>.testnet
```
Then run `app` with `NEXT_PUBLIC_CHECKOUT_CONTRACT_ID` and `NEXT_PUBLIC_DEMO_MERCHANT_ACCOUNT` also set, and visit `/store`.

## Priority order for the remaining build days

1. Deploy `mandate` and `task-market` to testnet; confirm the full README "Run it" sequence reproduces, including a worker actually winning and getting paid for a job.
2. Confirm the Guard fail-closed demo (README step 5) actually revokes mid-flow.
3. Record the demo video: post a job on `/swarm`, a worker bids and gets assigned, it delivers, accept & settle pays it — then show `/developers` and note Checkout is the same pattern.
4. Stretch, only with days to spare: wire a real LLM call into `worker.ts`'s `runWork`; verify the Checkout Intents branch against live docs.

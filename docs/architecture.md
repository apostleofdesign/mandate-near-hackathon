# Architecture

```
            funds (NEAR Intents, any chain)
                      |
                      v
   human  --issue_mandate-->  COORDINATOR agent
                                |   ^
                       sub-bounty | | sub-bounty result
                     (post_task) |   | (deliver)
                                v   |
                        TASK MARKET contract
                           ^           |
                    bid /  |           | assign / accept_and_settle
                    deliver|           v
                     WORKER agent(s) <--+

   MANDATE REGISTRY contract
     - every spend (coordinator -> task market, requester -> worker) is
       checked by authorize_spend before it's allowed to proceed
     - GUARD agent polls spend velocity per mandate and calls revoke()
       independently of the issuer the moment something looks wrong
```

## Why two contracts instead of one

`mandate` and `task-market` are deliberately separate:

- **Mandate** is a general-purpose policy primitive — it doesn't know about tasks, bounties, or bidding. Anything an agent spends on (API calls, compute, another contract entirely) can be gated through it.
- **Task Market** is one *consumer* of that primitive. A requester's spend into the market should be checked against their mandate the same way a coordinator's sub-bounty is — the market itself doesn't need to special-case who's paying.

This also means the Mandate registry is independently useful for the **Autonomous Business** track framing (a company-of-one agent's entire treasury can sit behind one mandate) without duplicating the Task Market's logic.

## Delegation chain (why this reads as a swarm, not one agent)

1. A human funds a mandate for the **coordinator** with a daily cap (e.g. 5 NEAR/day) and no contract allow-list restriction beyond the task market.
2. The coordinator receives a bounty ("write a market brief"), decomposes it into subtasks, and for each one: calls `authorize_spend` against its own mandate, then `post_task` on the market with that budget attached.
3. Each **worker** agent bids under the subtask's budget; the coordinator (as that subtask's requester) assigns a winner.
4. The worker delivers a result hash; the coordinator accepts, which pays the worker directly from the task's escrowed budget — the coordinator's mandate was only debited once, at posting time.
5. The **guard** polls every mandate's `spent_today` against its `daily_cap` on an interval; a spend that eats more than half the remaining cap in one tick gets the mandate revoked, freezing the coordinator (or any worker with its own mandate) mid-swarm.

## What's stubbed vs. real

| Piece | State |
| --- | --- |
| `contracts/mandate` | Full logic: issue, authorize, revoke, day-rollover. Ready to build/deploy. |
| `contracts/task-market` | Full logic: post, bid, assign, deliver, settle. Ready to build/deploy. |
| `agents/coordinator.ts` | Real decomposition logic is a `TODO` (currently deterministic for reproducibility); contract calls are marked, not yet wired. |
| `agents/worker.ts` | Bidding/polling loop and LLM call are `TODO`; hashing and structure are real. |
| `agents/guard.ts` | Velocity math is real and unit-testable; mandate enumeration (needs an indexer or a `get_mandates_for_owner` view) is `TODO`. |
| `app/` | Wallet connect and contract id wiring are real; mandate/task list views are `TODO`. |

## Stretch goals, in priority order

1. Wire the three agent scripts to a real LLM (Claude) for decomposition and work product, replacing the deterministic stubs.
2. `get_mandates_for_owner` / `get_open_tasks` view methods so the guard and dashboard don't need hardcoded ids.
3. NEAR Intents funding flow: human funds the coordinator's mandate from any chain/asset in one step.
4. Chain Signatures: let a worker settle a payout directly on another chain instead of native NEAR.

# Architecture

## The checkout flow (the flagship)

```
  customer's chain/asset                 NEAR
  (ETH, SOL, USDC, ...)                   |
         |                                |
         v  1-Click quote + deposit       |
    [ NEAR Intents solver network ] ------+
                                           |
                                           v
                                   customer's NEAR account
                                           |
   if the payer is an agent:              |
   MANDATE.authorize_spend(id, checkout, amount)  <-- fails closed: revoked /
         |  (panics = nothing below runs)             expired / over cap /
         v                                             target not allow-listed
                                           |
                                           v
                              CHECKOUT.create_order(merchant, amount, memo)
                              CHECKOUT.pay_order(order_id)  [attached deposit]
                                           |
                                           v
                                   merchant's NEAR account
```

A **human** customer skips the Mandate step entirely — they're spending their own money, there's nothing to cap. An **AI agent** always goes through `authorize_spend` first. The widget (`app/components/CheckoutWidget.tsx`) and the headless demo (`agents/src/shopping-agent.ts`) both encode this same branch; the Checkout contract itself never knows or cares which kind of payer it just got paid by.

## Why Mandate and Checkout are separate contracts

Same reasoning as the original design: **Mandate** is a general-purpose policy primitive that doesn't know about orders or merchants — anything an agent spends on can be gated through it. **Checkout** is one *consumer* of that primitive, and it stays usable by any payer, mandated or not, because it never calls into Mandate itself. The caller is responsible for calling `authorize_spend` first if it needs to; Checkout just has to answer "was this order paid, by whom, for how much" reliably.

## What's real vs. what's a stub

| Piece | State |
| --- | --- |
| `contracts/mandate` | Full logic: issue, authorize, revoke, day-rollover. Ready to build/deploy. |
| `contracts/checkout` | Full logic: register merchant, create/pay/cancel order. Ready to build/deploy. |
| `agents/src/shopping-agent.ts` | Real, wired end to end for the NEAR-direct path — this is the one script a judge should actually run. |
| `app/components/CheckoutWidget.tsx` | Real for the NEAR-direct path. The cross-chain-via-Intents branch calls `app/lib/intents.ts`, which is a best-effort client against an unverified endpoint shape — flagged inline, needs a check against `docs.near-intents.org` before it's trustworthy. |
| `app/app/store` | Real demo storefront page. |
| `contracts/task-market`, `agents/src/{coordinator,worker,guard}.ts` | The swarm-for-hire stretch goal (see below) — logic for `task-market` is complete and buildable; the three agent scripts are structural scaffolds with the real decomposition/bidding/LLM calls still marked `TODO`. |

## Stretch goal: swarm-for-hire

Illia Polosukhin's hackathon post also asked for a "swarm-for-hire": post a bounty, anyone can add a new agent to the swarm by funding it with NEAR (which pays for its NEAR AI inference), with governance or AI review gating which agents get admitted. `contracts/task-market` plus the `coordinator`/`worker`/`guard` scripts are exactly that primitive, built in a prior iteration and kept in the repo — a coordinator agent, itself holding a Mandate, can sub-bounty pieces of a job to worker agents from its own capped treasury, with the same Guard watcher revoking anything that spends too fast. If time allows after the checkout flow is solid, this is the natural extension: it reuses Mandate as-is and adds a second surface for the same primitive, rather than a second, unrelated project.

## Priority order for the remaining build days

1. Deploy `mandate` and `checkout` to testnet dev accounts; confirm the full "Run it" sequence in the README actually reproduces, including the fail-closed revoke demo.
2. Verify `app/lib/intents.ts` against the real 1-Click API docs and get one real cross-chain quote working, even if execution stays manual for the demo video.
3. Record the demo: a human paying directly, then the shopping agent paying under a mandate, then revoking the mandate and showing the same script fail closed.
4. Stretch, only if 1–3 are solid with days to spare: wire one real LLM call into `worker.ts` so the swarm stretch goal is more than a structural scaffold.

# Mandate Checkout

A universal checkout widget — any merchant, any customer wallet or chain, via NEAR Intents — built so the exact same flow works for a human paying their own money and an AI agent spending under a capped, revocable permission instead of a raw key. Built for **NEAR HACKATHON** (Build Beyond Boundaries, 1–14 Nov 2026).

Tracks: **Real-World Money** (`realworld`) · **Agent Economy** (`agents`) · **AI Security & Defense** (`security`) · fits **Unstoppable DeFi** (`defi`) via Intents settlement

## The problem

Three things are true at once right now:

1. A merchant who wants to accept payment from "whatever wallet a customer already has" has to integrate every chain separately — or just doesn't bother, and loses the sale.
2. Giving an AI agent a wallet for autonomous purchasing means giving it a real private key: unbounded authority, with no way to cap or revoke it short of cutting the key entirely.
3. Every judge we could find public statements from raised one of these two problems independently — not as a hackathon prompt, but as their own stated skepticism of "crypto + AI agents" projects in general.

## What we built

- **`contracts/mandate`** — a revocable, policy-bounded spending permission. Daily cap, optional contract allow-list, optional expiry, every spend checked and recorded on-chain before it's allowed to proceed. A `guard` account independent of whoever issued the mandate can force-revoke it the instant spend velocity looks wrong.
- **`contracts/checkout`** — the on-chain settlement record behind the widget: a merchant registers once, a storefront creates an order, a payer pays it. It doesn't know or care what chain the customer started on — by the time `pay_order` runs, NEAR Intents has already converted whatever they held into NEAR.
- **`app/components/CheckoutWidget.tsx`** — the embeddable widget itself. Pass it a merchant, an amount, and optionally a `mandateId`; it handles the rest identically either way.
- **`app/app/store`** — a demo storefront running the widget against a real product.
- **`agents/src/shopping-agent.ts`** — the flagship demo: an AI agent holding a procurement Mandate buys the demo product end to end — authorize, create order, pay — with every call real and on-chain, not simulated.
- **`agents/src/{coordinator,worker,guard}.ts`** plus **`contracts/task-market`** — a stretch goal, not the core submission: extending the same Mandate primitive into a swarm-for-hire marketplace (agents bidding on sub-tasks under their own capped treasuries). See [`docs/architecture.md`](docs/architecture.md) for what's wired vs. stubbed.

How NEAR fits: settlement is native NEAR transfers on `checkout.pay_order`; **NEAR Intents** is what gets the customer there from any chain/wallet in the first place (`app/lib/intents.ts`); mandates are built on the same idea as NEAR's native **function-call access keys**, formalized as an explicit, inspectable policy object instead of an opaque key, with revocation (`guard`) as a first-class operation instead of an emergency measure.

## Why this, specifically

We read what all seven judges have actually said in public — investment theses, portfolio bets, interviews, essays — before picking this direction. The short version: Avichal Garg (Electric Capital) has publicly asked, on a NEARCON panel, who holds the keys once agents have wallets. Mert Mumtaz (Helius) has said AI agent payments are pointless unless they do something a Stripe integration structurally can't. Haseeb Qureshi (Dragonfly) has said he wouldn't trust an agent with his own portfolio at current reliability. Illia Polosukhin's own numbers show the NEAR Intents fee switch is the protocol's biggest revenue lever, and he's publicly named a Shopify-style checkout as the kind of thing he wants built. This project is a direct answer to all four at once: a capped, revocable, auditable permission (not a raw key), doing something no card network can (any-chain acceptance, enforced in code, not policy), that drives real, recurring Intents volume on every single transaction.

## Status

- `contracts/mandate` and `contracts/checkout` — full logic, ready to build and deploy.
- `app/components/CheckoutWidget.tsx` and `agents/src/shopping-agent.ts` — real, wired calls end to end for the NEAR-direct payment path; the cross-chain-via-Intents path calls a best-effort 1-Click client (`app/lib/intents.ts`) that needs its endpoint/schema verified against `docs.near-intents.org` before relying on it (flagged inline).
- `contracts/task-market` and the coordinator/worker/guard agent scripts — the swarm-for-hire stretch goal from last iteration, intentionally not the focus this round. See architecture doc.

## Run it

**1 — Build the contracts.** See them compile and produce wasm artifacts.

```bash
cd contracts
rustup target add wasm32-unknown-unknown
./build.sh
```
Expected result: `out/mandate.wasm`, `out/checkout.wasm`, and `out/task_market.wasm` all exist.

**2 — Deploy to testnet dev accounts.** See three contracts live on-chain.

```bash
near create-account mandate-dev.<you>.testnet --useFaucet
near deploy mandate-dev.<you>.testnet out/mandate.wasm --initFunction new --initArgs '{"guard":"guard-dev.<you>.testnet"}'

near create-account checkout-dev.<you>.testnet --useFaucet
near deploy checkout-dev.<you>.testnet out/checkout.wasm --initFunction new --initArgs '{}'

near create-account merchant-dev.<you>.testnet --useFaucet
near call checkout-dev.<you>.testnet register_merchant '{"label":"Demo Store"}' --accountId merchant-dev.<you>.testnet
```
Expected result: `near state <contract>.testnet` shows deployed code for both, and `get_merchant` returns the registered merchant.

**3 — Run the dashboard and demo storefront.** See a human pay as themselves.

```bash
cd app
npm install
NEXT_PUBLIC_NEAR_NETWORK=testnet \
NEXT_PUBLIC_MANDATE_CONTRACT_ID=mandate-dev.<you>.testnet \
NEXT_PUBLIC_CHECKOUT_CONTRACT_ID=checkout-dev.<you>.testnet \
NEXT_PUBLIC_DEMO_MERCHANT_ACCOUNT=merchant-dev.<you>.testnet \
npm run dev
```
Expected result: `localhost:3000/store` shows the demo product; connecting a testnet wallet and choosing "NEAR (direct)" completes a real `pay_order` call.

**4 — Issue a mandate and run the shopping agent.** See an AI agent check out under a capped permission.

```bash
near create-account shopper.mandate.testnet --useFaucet
near call mandate-dev.<you>.testnet issue_mandate \
  '{"owner":"shopper.mandate.testnet","daily_cap":"5000000000000000000000000","allowed_contracts":["checkout-dev.<you>.testnet"],"expires_at":0}' \
  --accountId <you>.testnet

cd agents
npm install
NEAR_AGENT_ACCOUNT=shopper.mandate.testnet \
MANDATE_CONTRACT_ID=mandate-dev.<you>.testnet \
CHECKOUT_CONTRACT_ID=checkout-dev.<you>.testnet \
MERCHANT_ACCOUNT=merchant-dev.<you>.testnet \
MANDATE_ID=0 \
npm run shop
```
Expected result: the script logs "mandate authorized the spend", an order id, and a transaction hash — `get_order` on the checkout contract now shows that order as `Paid`.

**5 — See the fail-closed path.** Revoke the mandate, then rerun step 4's `npm run shop`.

```bash
near call mandate-dev.<you>.testnet revoke '{"id":0}' --accountId <you>.testnet
```
Expected result: `authorize_spend` panics with `mandate revoked`, the script exits non-zero, and no order is ever created — the Security track story, live.

## Disclosure (per `HACKATHON.md` Q-005 / Q-017)

- All code written from 28 Oct 2026 onward, inside the eligible window that opened with the announcement on 19 Oct 2026. Direction was substantially revised on 5 Nov 2026 after reading the hackathon judges' public statements and Illia Polosukhin's follow-up idea post — the universal checkout concept is his, built out with our Mandate permission layer.
- Built with AI pair-programming (Claude Code) for contract and scaffold code and for the judge research that shaped this direction; architecture, track strategy and all design decisions directed by the team.
- No pre-existing libraries or templates beyond standard `near-sdk`, `near-api-js`, and `next` scaffolding.
- No NEAR Intents testnet exists (per Q-007) — the cross-chain path in `app/lib/intents.ts` will be tested on mainnet with a separate dev account and `dry: true` quotes before any real transfer.

## License

MIT — see [`LICENSE`](LICENSE).

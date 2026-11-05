// The flagship demo: an AI agent with a weekly procurement Mandate buys a
// real product from the demo storefront end to end. Unlike worker.ts and
// coordinator.ts (still stubbed for the swarm stretch goal), every call here
// is real — this is the path a judge should be able to run and watch settle
// on-chain.
//
// Usage:
//   NEAR_AGENT_ACCOUNT=shopper.mandate.testnet \
//   MANDATE_CONTRACT_ID=mandate-dev.<you>.testnet \
//   CHECKOUT_CONTRACT_ID=market-dev.<you>.testnet \
//   MANDATE_ID=0 \
//   MERCHANT_ACCOUNT=merchant-dev.<you>.testnet \
//   npm run shop
import { connectAs } from "./near-client";

const MANDATE_CONTRACT_ID = process.env.MANDATE_CONTRACT_ID ?? "";
const CHECKOUT_CONTRACT_ID = process.env.CHECKOUT_CONTRACT_ID ?? "";
const MERCHANT_ACCOUNT = process.env.MERCHANT_ACCOUNT ?? "";
const MANDATE_ID = Number(process.env.MANDATE_ID ?? "0");
const PRICE_YOCTO = process.env.PRICE_YOCTO ?? "1000000000000000000000000"; // 1 NEAR

async function main() {
  const accountId = process.env.NEAR_AGENT_ACCOUNT;
  if (!accountId) throw new Error("set NEAR_AGENT_ACCOUNT");
  if (!MANDATE_CONTRACT_ID || !CHECKOUT_CONTRACT_ID || !MERCHANT_ACCOUNT) {
    throw new Error("set MANDATE_CONTRACT_ID, CHECKOUT_CONTRACT_ID, MERCHANT_ACCOUNT");
  }

  const near = await connectAs(accountId);
  const account = await near.account(accountId);

  console.log(`[shopping-agent] ${accountId} checking out at ${MERCHANT_ACCOUNT} under mandate #${MANDATE_ID}`);

  // 1. Ask the Mandate registry to authorize this spend. Throws (and this
  //    script exits non-zero) if the mandate is revoked, expired, over its
  //    daily cap, or CHECKOUT_CONTRACT_ID isn't on its allow-list.
  await account.functionCall({
    contractId: MANDATE_CONTRACT_ID,
    methodName: "authorize_spend",
    args: { id: MANDATE_ID, target: CHECKOUT_CONTRACT_ID, amount: PRICE_YOCTO },
    gas: 30_000_000_000_000n,
  });
  console.log("[shopping-agent] mandate authorized the spend");

  // 2. Create the order against the demo storefront's product.
  const orderId = await account.functionCall({
    contractId: CHECKOUT_CONTRACT_ID,
    methodName: "create_order",
    args: { merchant: MERCHANT_ACCOUNT, amount: PRICE_YOCTO, memo: "shopping-agent-order" },
    gas: 30_000_000_000_000n,
  });
  console.log(`[shopping-agent] order created: ${JSON.stringify(orderId)}`);

  // 3. Pay it — the agent's own account funds the attached deposit, capped
  //    only by whatever `authorize_spend` just allowed.
  const orderIdValue = parseOrderId(orderId);
  const receipt = await account.functionCall({
    contractId: CHECKOUT_CONTRACT_ID,
    methodName: "pay_order",
    args: { order_id: orderIdValue },
    gas: 50_000_000_000_000n,
    attachedDeposit: BigInt(PRICE_YOCTO),
  });
  console.log(`[shopping-agent] paid. tx: ${receipt.transaction.hash}`);
}

function parseOrderId(result: unknown): number {
  // near-api-js functionCall returns the full transaction outcome; the
  // method's return value is base64-encoded in status.SuccessValue.
  const outcome = result as { status?: { SuccessValue?: string } };
  const raw = outcome.status?.SuccessValue;
  if (!raw) throw new Error("create_order did not return a value");
  return JSON.parse(Buffer.from(raw, "base64").toString("utf8"));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

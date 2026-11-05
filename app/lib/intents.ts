// Thin client for NEAR Intents' 1-Click quote/execute flow — the piece that
// lets a customer pay from whatever chain/asset they hold, landing NEAR in
// their account just before CheckoutWidget calls `pay_order`.
//
// IMPORTANT: the request/response shape here is a best-effort scaffold, not
// verified against a live response. Confirm the current endpoint, fields and
// auth header against https://docs.near-intents.org/ before relying on it —
// HACKATHON.md Q-009 says exactly this: check current endpoints there, don't
// assume. Register a 1Click JWT at https://partners.near-intents.org to avoid
// the 0.2% fallback fee (HACKATHON.md Q-006).

const ONE_CLICK_BASE_URL = process.env.NEXT_PUBLIC_ONE_CLICK_BASE_URL ?? "https://1click.chaindefuser.com";
const ONE_CLICK_JWT = process.env.NEXT_PUBLIC_ONE_CLICK_JWT; // optional; omitting it means the 0.2% fee applies

export type IntentsQuoteRequest = {
  originAsset: string; // e.g. "nep141:eth.bridge.near" or a chain-specific asset id — verify format in the docs
  destinationAsset: string; // the merchant's desired asset, usually NEAR
  amountOut: string; // yoctoNEAR the order needs, as a string
  recipient: string; // the NEAR account that will call pay_order
};

export type IntentsQuote = {
  quoteId: string;
  amountIn: string;
  amountOut: string;
  expiresAt: string;
  depositAddress: string; // where the customer sends their origin-chain asset
};

export async function getQuote(req: IntentsQuoteRequest): Promise<IntentsQuote> {
  const res = await fetch(`${ONE_CLICK_BASE_URL}/v0/quote`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(ONE_CLICK_JWT ? { Authorization: `Bearer ${ONE_CLICK_JWT}` } : {}),
    },
    body: JSON.stringify(req),
  });
  if (!res.ok) throw new Error(`quote failed: ${res.status} ${await res.text()}`);
  return res.json();
}

export async function getExecutionStatus(quoteId: string): Promise<{ status: string }> {
  const res = await fetch(`${ONE_CLICK_BASE_URL}/v0/status?quoteId=${encodeURIComponent(quoteId)}`);
  if (!res.ok) throw new Error(`status check failed: ${res.status} ${await res.text()}`);
  return res.json();
}

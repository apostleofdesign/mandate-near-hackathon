// Demo storefront: a single product, checked out two ways — as a human
// paying from their own wallet, and as the AI shopping agent paying under a
// Mandate. See README "Run it" step 5 for how to drive each path.
"use client";

import { useEffect, useState } from "react";
import { getWallet } from "../../lib/near";
import CheckoutWidget from "../../components/CheckoutWidget";
import type { WalletConnection } from "near-api-js";

const MERCHANT_ACCOUNT = process.env.NEXT_PUBLIC_DEMO_MERCHANT_ACCOUNT ?? "";
const PRODUCT_PRICE_YOCTO = "1000000000000000000000000"; // 1 NEAR, demo price

export default function StorePage() {
  const [wallet, setWallet] = useState<WalletConnection | null>(null);

  useEffect(() => {
    getWallet().then(setWallet);
  }, []);

  return (
    <main style={{ fontFamily: "ui-monospace, monospace", padding: 32, maxWidth: 480 }}>
      <h1>Demo Store</h1>
      <p>One product. Checkout accepts any wallet, any chain, and also accepts an AI shopping agent spending under a capped Mandate.</p>

      <div style={{ border: "1px solid #ccc", borderRadius: 8, padding: 16, marginBottom: 24 }}>
        <h2 style={{ fontSize: 16, margin: "0 0 4px" }}>Mandate Hoodie</h2>
        <p style={{ margin: "0 0 12px", color: "#666" }}>1 NEAR · merchant: {MERCHANT_ACCOUNT || "not configured"}</p>

        {wallet ? (
          <CheckoutWidget
            wallet={wallet}
            merchantAccount={MERCHANT_ACCOUNT}
            amountYocto={PRODUCT_PRICE_YOCTO}
            memo="demo-storefront-order"
            onPaid={(orderId) => console.log("paid order", orderId)}
          />
        ) : (
          <p>Connecting wallet…</p>
        )}
      </div>

      <section>
        <h2 style={{ fontSize: 14 }}>Try the agent path</h2>
        <p style={{ fontSize: 13, color: "#666" }}>
          Run the shopping agent script (<code>agents/src/shopping-agent.ts</code>) against this same
          merchant and product — it calls the identical <code>CheckoutWidget</code> flow headlessly,
          passing its own <code>mandateId</code> instead of a human wallet session.
        </p>
      </section>
    </main>
  );
}

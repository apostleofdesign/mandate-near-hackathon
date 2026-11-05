// Demo storefront: a single product, checked out two ways — as a human
// paying from their own wallet, and as the AI shopping agent paying under a
// Mandate. See README "Run it" step 5 for how to drive each path.
"use client";

import { useEffect, useState } from "react";
import { getWallet } from "../../lib/near";
import CheckoutWidget from "../../components/CheckoutWidget";
import type { WalletConnection } from "near-api-js";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { RiShoppingBag3Line, RiRobot2Line } from "@remixicon/react";

const MERCHANT_ACCOUNT = process.env.NEXT_PUBLIC_DEMO_MERCHANT_ACCOUNT ?? "";
const PRODUCT_PRICE_YOCTO = "1000000000000000000000000"; // 1 NEAR, demo price

export default function StorePage() {
  const [wallet, setWallet] = useState<WalletConnection | null>(null);

  useEffect(() => {
    getWallet().then(setWallet);
  }, []);

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-10 px-6 py-16">
      <div className="flex flex-col gap-2">
        <Badge variant="outline" className="w-fit gap-1.5">
          <RiShoppingBag3Line className="size-3.5" />
          Demo Store
        </Badge>
        <h1 className="font-heading text-2xl font-medium tracking-tight">Mandate Checkout</h1>
        <p className="max-w-lg text-sm text-muted-foreground">
          One product. Checkout accepts any wallet, any chain, and also accepts an AI shopping
          agent spending under a capped, revocable Mandate.
        </p>
      </div>

      <div className="grid gap-8 sm:grid-cols-[1fr_auto] sm:items-start">
        <div className="flex items-center gap-4 rounded-xl border bg-card p-5">
          <div className="flex size-16 shrink-0 items-center justify-center rounded-lg bg-muted">
            <RiShoppingBag3Line className="size-7 text-muted-foreground" />
          </div>
          <div className="flex flex-col gap-1">
            <h2 className="font-heading text-base font-medium">Mandate Hoodie</h2>
            <p className="text-sm text-muted-foreground">1 NEAR</p>
            <p className="text-xs text-muted-foreground">
              Merchant: {MERCHANT_ACCOUNT || <span className="text-destructive">not configured</span>}
            </p>
          </div>
        </div>

        {wallet ? (
          <CheckoutWidget
            wallet={wallet}
            merchantAccount={MERCHANT_ACCOUNT}
            amountYocto={PRODUCT_PRICE_YOCTO}
            memo="demo-storefront-order"
            onPaid={(orderId) => console.log("paid order", orderId)}
          />
        ) : (
          <Skeleton className="h-64 w-full max-w-sm rounded-xl" />
        )}
      </div>

      <div className="flex items-start gap-3 rounded-xl border bg-muted/40 p-5">
        <RiRobot2Line className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
        <div className="flex flex-col gap-1">
          <h3 className="text-sm font-medium">Try the agent path</h3>
          <p className="text-sm text-muted-foreground">
            Run the shopping agent script (<code className="rounded bg-muted px-1 py-0.5 text-xs">agents/src/shopping-agent.ts</code>)
            against this same merchant and product — it drives the identical checkout flow headlessly,
            passing its own <code className="rounded bg-muted px-1 py-0.5 text-xs">mandateId</code> instead of a human wallet session.
          </p>
        </div>
      </div>
    </main>
  );
}

// Starting point for the dashboard: connect a wallet, list mandates and
// open tasks. Replace the placeholder sections as the contracts get deployed —
// see the root README's "Run it" steps for the deploy + env var sequence.
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getWallet, MANDATE_CONTRACT_ID, TASK_MARKET_CONTRACT_ID, CHECKOUT_CONTRACT_ID } from "../lib/near";
import type { WalletConnection } from "near-api-js";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { RiShieldCheckLine, RiArrowRightLine, RiWalletLine, RiCheckboxCircleFill } from "@remixicon/react";

const CONTRACTS = [
  { label: "Mandate", id: MANDATE_CONTRACT_ID, required: true },
  { label: "Checkout", id: CHECKOUT_CONTRACT_ID, required: true },
  { label: "Task Market (swarm stretch goal)", id: TASK_MARKET_CONTRACT_ID, required: false },
];

export default function Home() {
  const [wallet, setWallet] = useState<WalletConnection | null>(null);
  const [accountId, setAccountId] = useState<string | null>(null);

  useEffect(() => {
    getWallet().then((w) => {
      setWallet(w);
      setAccountId(w.isSignedIn() ? w.getAccountId() : null);
    });
  }, []);

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-10 px-6 py-16">
      <div className="flex flex-col gap-2">
        <Badge variant="outline" className="w-fit gap-1.5">
          <RiShieldCheckLine className="size-3.5" />
          NEAR HACKATHON
        </Badge>
        <h1 className="font-heading text-2xl font-medium tracking-tight">Mandate Checkout</h1>
        <p className="max-w-lg text-sm text-muted-foreground">
          A universal checkout widget, built so it works identically for a human paying their own
          funds and an AI agent spending under a capped, revocable permission instead of a raw key.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Contracts</CardTitle>
          <CardDescription>Fill these in once deployed — see README &ldquo;Run it&rdquo;.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {CONTRACTS.map((c) => (
            <div key={c.label} className="flex items-center justify-between gap-4">
              <span className="text-sm text-muted-foreground">{c.label}</span>
              {c.id ? (
                <code className="truncate rounded bg-muted px-2 py-1 text-xs">{c.id}</code>
              ) : (
                <Badge variant={c.required ? "destructive" : "secondary"}>not configured</Badge>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      <Separator />

      <div className="flex flex-col gap-3">
        {accountId ? (
          <div className="flex items-center gap-2 text-sm">
            <RiCheckboxCircleFill className="size-4 text-primary" />
            Signed in as <span className="font-medium">{accountId}</span>
          </div>
        ) : (
          <Button onClick={() => wallet?.requestSignIn({ contractId: MANDATE_CONTRACT_ID, keyType: "ed25519" })} className="w-fit gap-2">
            <RiWalletLine className="size-4" />
            Connect wallet
          </Button>
        )}

        <Button render={<Link href="/store" />} nativeButton={false} variant="secondary" className="w-fit gap-2">
          Try the demo storefront
          <RiArrowRightLine className="size-4" />
        </Button>
      </div>

      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="text-sm">TODO</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="list-disc space-y-1.5 pl-4 text-sm text-muted-foreground">
            <li>List mandates for the connected account via get_mandate.</li>
            <li>Live spend-vs-cap bar per mandate, fed by the Guard watcher.</li>
            <li>Order history view fed by Checkout&apos;s get_order.</li>
          </ul>
        </CardContent>
      </Card>
    </main>
  );
}

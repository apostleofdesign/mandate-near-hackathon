// Home: Mandate is the permission primitive. Everything else on this site is
// a surface built on top of it — Hire a Swarm is the flagship, Checkout is a
// second working surface, Developers is the integration guide proving it's
// reusable infra, not a one-off feature.
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getWallet, MANDATE_CONTRACT_ID, TASK_MARKET_CONTRACT_ID, CHECKOUT_CONTRACT_ID } from "../lib/near";
import type { WalletConnection } from "near-api-js";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  RiShieldCheckLine,
  RiArrowRightLine,
  RiWalletLine,
  RiCheckboxCircleFill,
  RiGroupLine,
  RiShoppingBag3Line,
  RiToolsLine,
} from "@remixicon/react";

const CONTRACTS = [
  { label: "Mandate", id: MANDATE_CONTRACT_ID, required: true },
  { label: "Task Market", id: TASK_MARKET_CONTRACT_ID, required: true },
  { label: "Checkout", id: CHECKOUT_CONTRACT_ID, required: false },
];

const SURFACES = [
  {
    href: "/swarm",
    icon: RiGroupLine,
    title: "Hire a Swarm",
    desc: "Post a job, worker agents bid, assign and settle on-chain.",
    primary: true,
  },
  {
    href: "/developers",
    icon: RiToolsLine,
    title: "Developers",
    desc: "Integrate Mandate into your own NEAR app in two calls.",
    primary: false,
  },
  {
    href: "/store",
    icon: RiShoppingBag3Line,
    title: "Checkout demo",
    desc: "Universal checkout, gated by the same mandate.",
    primary: false,
  },
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
        <h1 className="font-heading text-2xl font-medium tracking-tight">Mandate</h1>
        <p className="max-w-lg text-sm text-muted-foreground">
          A capped, revocable, allow-listed spending permission for AI agents — instead of a raw key.
          Hire a Swarm is the flagship surface built on it; it isn&apos;t the only one.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {SURFACES.map((s) => (
          <Button
            key={s.href}
            render={<Link href={s.href} />}
            nativeButton={false}
            variant={s.primary ? "default" : "outline"}
            className="h-auto flex-col items-start gap-1 whitespace-normal px-4 py-3.5 text-left"
          >
            <s.icon className="size-4" />
            <span className="font-medium">{s.title}</span>
            <span className={s.primary ? "text-xs font-normal opacity-90" : "text-xs font-normal text-muted-foreground"}>
              {s.desc}
            </span>
          </Button>
        ))}
      </div>

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

      <Separator />

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

      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="text-sm">TODO</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="list-disc space-y-1.5 pl-4 text-sm text-muted-foreground">
            <li>Live spend-vs-cap bar per mandate on this page, fed by list_mandates.</li>
            <li>Wire a real LLM call into agents/worker.ts's runWork.</li>
            <li>Verify the cross-chain Intents branch in the checkout widget against live docs.</li>
          </ul>
        </CardContent>
      </Card>
    </main>
  );
}

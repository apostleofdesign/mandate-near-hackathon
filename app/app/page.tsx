// Home: Mandate is the permission primitive. Hire a Swarm is the flagship
// surface built on it; Developers is the integration guide proving it's
// reusable infra, not a one-off feature. This page also doubles as the
// Mandate dashboard — every mandate's live spend vs. cap, fed by list_mandates.
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { viewFunction, MANDATE_CONTRACT_ID, TASK_MARKET_CONTRACT_ID } from "../lib/near";
import { useNearWallet } from "../lib/useNearWallet";
import { toNear } from "../lib/format";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  RiShieldCheckLine,
  RiWalletLine,
  RiCheckboxCircleFill,
  RiGroupLine,
  RiToolsLine,
} from "@remixicon/react";

type Mandate = {
  id: number;
  owner: string;
  issuer: string;
  daily_cap: string;
  spent_today: string;
  allowed_contracts: string[];
  expires_at: number;
  revoked: boolean;
};

const CONTRACTS = [
  { label: "Mandate", id: MANDATE_CONTRACT_ID, required: true },
  { label: "Task Market", id: TASK_MARKET_CONTRACT_ID, required: true },
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
];

export default function Home() {
  const { accountId, connect } = useNearWallet();
  const [mandates, setMandates] = useState<Mandate[] | null>(null);

  const refreshMandates = useCallback(async () => {
    try {
      const result = await viewFunction<Mandate[]>(MANDATE_CONTRACT_ID, "list_mandates", {
        from_index: 0,
        limit: 50,
      });
      setMandates(result.slice().reverse());
    } catch {
      // Mandate isn't deployed/configured yet — show an empty state instead
      // of an unhandled rejection. See README "Run it" to deploy it.
      setMandates([]);
    }
  }, []);

  useEffect(() => {
    refreshMandates();
  }, [refreshMandates]);

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

      <div className="grid gap-3 sm:grid-cols-2">
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
        <Button onClick={() => connect()} className="w-fit gap-2">
          <RiWalletLine className="size-4" />
          Connect wallet
        </Button>
      )}

      <Separator />

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Mandates</CardTitle>
          <CardDescription>Live spend vs. cap, straight from list_mandates — no indexer.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {mandates === null && (
            <div className="flex flex-col gap-3">
              <Skeleton className="h-14 w-full rounded-lg" />
              <Skeleton className="h-14 w-full rounded-lg" />
            </div>
          )}
          {mandates !== null && mandates.length === 0 && (
            <p className="text-sm text-muted-foreground">No mandates issued yet.</p>
          )}
          {mandates?.map((m) => {
            const cap = BigInt(m.daily_cap);
            const spent = BigInt(m.spent_today);
            const pct = cap > 0n ? Number((spent * 100n) / cap) : 0;
            const expired = m.expires_at !== 0 && m.expires_at < Date.now() * 1_000_000;
            const dead = m.revoked || expired;
            return (
              <div key={m.id} className="flex flex-col gap-2">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="truncate font-medium">#{m.id} — {m.owner}</span>
                  {m.revoked ? (
                    <Badge variant="destructive">revoked</Badge>
                  ) : expired ? (
                    <Badge variant="secondary">expired</Badge>
                  ) : (
                    <Badge variant="outline">{pct}% of cap</Badge>
                  )}
                </div>
                <Progress
                  value={Math.min(pct, 100)}
                  className={dead ? "opacity-40" : pct > 80 ? "[&_[data-slot=progress-indicator]]:bg-destructive" : undefined}
                />
                <span className="text-xs text-muted-foreground">
                  {toNear(m.spent_today)} / {toNear(m.daily_cap)} NEAR today
                  {m.allowed_contracts.length > 0 && ` · allow-listed: ${m.allowed_contracts.join(", ")}`}
                </span>
              </div>
            );
          })}
        </CardContent>
      </Card>

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
    </main>
  );
}

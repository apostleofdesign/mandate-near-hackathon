// Home: Mandate is the permission primitive. Hire a Swarm is the flagship
// surface built on it; Developers is the integration guide proving it's
// reusable infra, not a one-off feature. This page is also the public
// landing page and doubles as the live Mandate dashboard, fed by
// list_mandates / list_tasks — every number here is a real chain read, not
// a marketing figure.
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  viewFunction,
  NETWORK_ID,
  MANDATE_CONTRACT_ID,
  TASK_MARKET_CONTRACT_ID,
} from "../lib/near";
import { useNearWallet } from "../lib/useNearWallet";
import { toNear } from "../lib/format";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { MandateMark } from "@/components/MandateMark";
import {
  RiShieldCheckLine,
  RiGroupLine,
  RiToolsLine,
  RiArrowRightLine,
  RiTimeLine,
  RiListCheck3,
  RiGithubFill,
  RiCompass3Line,
  RiSendPlaneLine,
  RiCheckboxCircleFill,
  RiHandCoinLine,
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

type Task = {
  id: number;
  status: "Open" | "Assigned" | "Delivered" | "Settled" | "Cancelled";
  budget: string;
};

const FEATURES = [
  {
    icon: RiShieldCheckLine,
    title: "Capped",
    desc: "A daily spend limit enforced on-chain, in the mandate itself — not a number an agent can talk its way past.",
  },
  {
    icon: RiTimeLine,
    title: "Revocable",
    desc: "Killed instantly by its issuer or a dedicated guard account, independent of whoever's funding the budget.",
  },
  {
    icon: RiListCheck3,
    title: "Allow-listed",
    desc: "Scoped to the contracts it's meant for. authorize_spend panics on anything else — fails closed, not open.",
  },
];

const STEPS = [
  { n: "01", title: "Issue", desc: "Grant an agent a capped, allow-listed mandate — a slice of spend, not a raw key." },
  { n: "02", title: "Authorize", desc: "Before every spend, the agent calls authorize_spend. Over cap, expired, or off the allow-list: it panics." },
  { n: "03", title: "Settle", desc: "Only a call that cleared the mandate reaches the real transaction. Spend and settlement happen atomically." },
];

const EXPLORER_BASE = `https://explorer.${NETWORK_ID}.near.org/accounts/`;

export default function Home() {
  const { accountId } = useNearWallet();
  const [mandates, setMandates] = useState<Mandate[] | null>(null);
  const [tasks, setTasks] = useState<Task[] | null>(null);

  const refresh = useCallback(async () => {
    try {
      const result = await viewFunction<Mandate[]>(MANDATE_CONTRACT_ID, "list_mandates", {
        from_index: 0,
        limit: 50,
      });
      setMandates(result.slice().reverse());
    } catch {
      setMandates([]);
    }
    try {
      const result = await viewFunction<Task[]>(TASK_MARKET_CONTRACT_ID, "list_tasks", {
        from_index: 0,
        limit: 50,
      });
      setTasks(result);
    } catch {
      setTasks([]);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const settled = tasks?.filter((t) => t.status === "Settled");
  const routedYocto = (settled ?? []).reduce((sum, t) => sum + BigInt(t.budget), 0n);
  const stats = [
    { label: "Mandates issued", value: mandates?.length, icon: RiShieldCheckLine },
    { label: "Jobs posted", value: tasks?.length, icon: RiSendPlaneLine },
    { label: "Jobs settled", value: settled?.length, icon: RiCheckboxCircleFill },
    { label: "NEAR routed", value: tasks && Number(toNear(routedYocto.toString())).toFixed(2), icon: RiHandCoinLine },
  ];

  return (
    <main className="flex min-h-screen flex-col">
      {/* Hero */}
      <section className="mx-auto flex w-full max-w-4xl flex-col items-start gap-6 px-6 pt-20 pb-16 sm:pt-28 sm:pb-20">
        <Badge variant="outline" className="w-fit gap-1.5">
          <span className="relative flex size-1.5">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-75" />
            <span className="relative inline-flex size-1.5 rounded-full bg-primary" />
          </span>
          Live on NEAR testnet
        </Badge>
        <h1 className="max-w-2xl font-heading text-4xl font-medium tracking-tight sm:text-5xl">
          A spending permission for agents — not a raw key.
        </h1>
        <p className="max-w-xl text-base text-muted-foreground sm:text-lg">
          Mandate is a capped, revocable, allow-listed permission contract on NEAR. Hire a Swarm is the
          flagship marketplace built on top of it — agents bid, deliver, and get paid, never past the
          cap you set.
        </p>
        <div className="flex flex-wrap items-center gap-3 pt-2">
          <Button render={<Link href="/swarm" />} nativeButton={false} size="lg" className="gap-2">
            <RiGroupLine className="size-4" />
            Hire a Swarm
          </Button>
          <Button render={<Link href="/developers" />} nativeButton={false} variant="outline" size="lg" className="gap-2">
            Read the docs
            <RiArrowRightLine className="size-4" />
          </Button>
        </div>
      </section>

      <div className="mx-auto flex w-full max-w-4xl flex-col gap-20 px-6 pb-20">
        {/* Live stats */}
        <section className="flex flex-col gap-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="relative flex size-1.5">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-75" />
              <span className="relative inline-flex size-1.5 rounded-full bg-primary" />
            </span>
            Live numbers, straight off the chain
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {stats.map((s) => (
              <Card key={s.label} className="gap-3 py-5 transition-colors hover:border-foreground/20">
                <CardContent className="flex flex-col gap-3">
                  <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <s.icon className="size-4" />
                  </span>
                  <span className="font-heading text-2xl font-medium tabular-nums">
                    {s.value === undefined ? <Skeleton className="h-7 w-14" /> : s.value}
                  </span>
                  <span className="text-xs text-muted-foreground">{s.label}</span>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* How it works */}
        <section className="flex flex-col gap-8">
          <div className="flex flex-col gap-2">
            <h2 className="font-heading text-xl font-medium tracking-tight">How it works</h2>
            <p className="max-w-lg text-sm text-muted-foreground">
              Three calls. The guard rail is the mandate, not application code remembering to check one.
            </p>
          </div>
          <div className="grid gap-6 sm:grid-cols-3">
            {STEPS.map((step) => (
              <div key={step.n} className="flex flex-col gap-2">
                <span className="font-heading text-sm text-primary">{step.n}</span>
                <h3 className="font-medium">{step.title}</h3>
                <p className="text-sm text-muted-foreground">{step.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Features */}
        <section className="grid gap-4 sm:grid-cols-3">
          {FEATURES.map((f) => (
            <Card key={f.title} className="gap-3">
              <CardHeader>
                <f.icon className="size-5 text-primary" />
                <CardTitle className="pt-1 text-sm">{f.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{f.desc}</p>
              </CardContent>
            </Card>
          ))}
        </section>

        {/* Live mandates dashboard */}
        <section className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex flex-col gap-1">
              <h2 className="font-heading text-xl font-medium tracking-tight">Mandates</h2>
              <p className="text-sm text-muted-foreground">
                Live spend vs. cap, straight from list_mandates — no indexer.
              </p>
            </div>
            <MandateMark className="hidden size-6 shrink-0 text-muted-foreground sm:block" />
          </div>
          <Card>
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
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="truncate font-medium">#{m.id} — {m.owner}</span>
                        {accountId === m.owner && (
                          <Badge variant="outline" className="shrink-0">
                            yours
                          </Badge>
                        )}
                      </span>
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
        </section>
      </div>

      {/* Footer */}
      <footer className="mt-auto border-t">
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-6 py-10">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-1.5 font-heading text-sm font-medium tracking-tight">
              <MandateMark className="size-4 text-primary" />
              Mandate
            </div>
            <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
              <a
                href="https://github.com/apostleofdesign/mandate-near-hackathon"
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 hover:text-foreground"
              >
                <RiGithubFill className="size-3.5" />
                Source
              </a>
              <Link href="/developers" className="flex items-center gap-1.5 hover:text-foreground">
                <RiToolsLine className="size-3.5" />
                Docs
              </Link>
              <a
                href={`https://explorer.${NETWORK_ID}.near.org`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 hover:text-foreground"
              >
                <RiCompass3Line className="size-3.5" />
                Explorer
              </a>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span>Contracts on {NETWORK_ID}:</span>
            <a href={`${EXPLORER_BASE}${MANDATE_CONTRACT_ID}`} target="_blank" rel="noreferrer">
              <code className="rounded bg-muted px-1.5 py-0.5 hover:text-foreground">{MANDATE_CONTRACT_ID}</code>
            </a>
            <a href={`${EXPLORER_BASE}${TASK_MARKET_CONTRACT_ID}`} target="_blank" rel="noreferrer">
              <code className="rounded bg-muted px-1.5 py-0.5 hover:text-foreground">{TASK_MARKET_CONTRACT_ID}</code>
            </a>
          </div>
        </div>
      </footer>
    </main>
  );
}

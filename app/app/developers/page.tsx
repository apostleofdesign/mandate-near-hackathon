// Dev tools: Mandate isn't a feature bolted onto one app — it's a standalone
// permission contract any NEAR app can gate spending through, the same way
// Task Market does. This page is the integration guide — the code-walkthrough
// half reads as one continuous terminal window; the reference half below it
// is plain structured docs.
import { RiToolsLine } from "@remixicon/react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import CodeBlock from "../../components/CodeBlock";
import DevNav from "../../components/DevNav";
import { NETWORK_ID, MANDATE_CONTRACT_ID, TASK_MARKET_CONTRACT_ID } from "../../lib/near";

const METHODS = [
  {
    name: "issue_mandate",
    kind: "change",
    sig: "issue_mandate(owner, daily_cap, allowed_contracts, expires_at) → MandateId",
    desc: "Grant an agent a capped, allow-listed, optionally expiring permission. Called by whoever is funding the budget — a human, or a coordinator delegating a slice of its own mandate.",
  },
  {
    name: "authorize_spend",
    kind: "change",
    sig: "authorize_spend(id, target, amount) → bool",
    desc: "Call this before your own contract call. Panics — aborting the whole transaction — if the mandate is revoked, expired, over its daily cap, or `target` isn't allow-listed. Succeeds silently otherwise.",
  },
  {
    name: "revoke",
    kind: "change",
    sig: "revoke(id)",
    desc: "Kill a mandate immediately. Callable by its issuer, or by whatever account is currently registered as `guard` — independent of the issuer, for exactly this reason. Exercised for real on the live deployment: see the README.",
  },
  {
    name: "set_guard",
    kind: "change",
    sig: "set_guard(new_guard)",
    desc: "Rotate the guard account. Callable only by the registry's `owner` — a third role, separate from `guard` and from any mandate's `issuer`, so losing the guard key doesn't mean losing the ability to replace it. Exercised live: rotated, the old key's `revoke` call was confirmed to fail, then rotated back.",
  },
  {
    name: "get_mandate",
    kind: "view",
    sig: "get_mandate(id) → Mandate | null",
    desc: "Read one mandate's current state: cap, spend-so-far, allow-list, expiry, revoked flag.",
  },
  {
    name: "list_mandates",
    kind: "view",
    sig: "list_mandates(from_index, limit) → Mandate[]",
    desc: "Page through every mandate ever issued. What a watcher process (or a dashboard) polls instead of needing an indexer.",
  },
  {
    name: "get_guard / get_owner",
    kind: "view",
    sig: "get_guard() → AccountId · get_owner() → AccountId",
    desc: "Read the current guard and owner accounts.",
  },
];

function TerminalSection({
  id,
  file,
  title,
  children,
}: {
  id: string;
  file: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div id={id} className="flex scroll-mt-24 flex-col gap-3">
      <div className="flex items-center gap-2 font-mono text-xs text-zinc-500">
        <span className="text-emerald-500">$</span>
        cat {file}
      </div>
      <h2 className="font-mono text-sm font-semibold text-zinc-100">{title}</h2>
      {children}
    </div>
  );
}

export default function DevelopersPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-4xl flex-col gap-10 px-6 py-16">
      <div className="flex flex-col gap-2">
        <Badge variant="outline" className="w-fit gap-1.5">
          <RiToolsLine className="size-3.5" />
          Dev tools
        </Badge>
        <h1 className="font-heading text-3xl font-medium tracking-tight">Build on Mandate</h1>
        <p className="max-w-xl text-sm text-muted-foreground">
          Mandate is a standalone NEAR contract, not a feature baked into one app. Hire a Swarm gates
          every job's budget through the exact same two calls below — your app can too, instead of
          writing its own spend-limit logic from scratch.
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-[160px_1fr]">
        <DevNav />

        <div className="flex min-w-0 flex-col gap-12">
          {/* One continuous terminal window for the code-walkthrough half */}
          <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950 shadow-sm">
            <div className="flex items-center gap-3 border-b border-zinc-800 bg-zinc-900/70 px-4 py-2.5">
              <div className="flex gap-1.5">
                <span className="size-2.5 rounded-full bg-[#ff5f56]" />
                <span className="size-2.5 rounded-full bg-[#ffbd2e]" />
                <span className="size-2.5 rounded-full bg-[#27c93f]" />
              </div>
              <span className="font-mono text-xs text-zinc-500">mandate — docs — zsh</span>
            </div>

            <div className="flex flex-col gap-10 p-5 sm:p-7">
              <TerminalSection id="quickstart" file="quickstart.env" title="Quickstart">
                <p className="text-sm text-zinc-400">Contract IDs for this live {NETWORK_ID} deployment.</p>
                <CodeBlock
                  lang="env"
                  code={`NEXT_PUBLIC_NEAR_NETWORK=${NETWORK_ID}\nNEXT_PUBLIC_MANDATE_CONTRACT_ID=${MANDATE_CONTRACT_ID}\nNEXT_PUBLIC_TASK_MARKET_CONTRACT_ID=${TASK_MARKET_CONTRACT_ID}`}
                />
              </TerminalSection>

              <TerminalSection id="pattern" file="pattern.md" title="The pattern">
                <p className="text-sm text-zinc-400">
                  Mandate never calls into your contract, and your contract never has to know Mandate
                  exists at the type level — the caller just does both calls in sequence. If the first
                  one panics, the second never runs.
                </p>
                <CodeBlock
                  lang="pattern"
                  code={`1. authorize_spend(mandate_id, your_contract_id, amount)   // fails closed
2. your_contract.your_method(...)                          // only reached if 1 succeeded`}
                />
              </TerminalSection>

              <TerminalSection id="typescript" file="integrate.ts" title="TypeScript — near-api-js">
                <p className="text-sm text-zinc-400">
                  The exact pattern{" "}
                  <code className="rounded bg-zinc-800 px-1 py-0.5 text-xs text-zinc-300">agents/src/coordinator.ts</code>{" "}
                  uses.
                </p>
                <CodeBlock
                  lang="typescript"
                  code={`await account.functionCall({
  contractId: MANDATE_CONTRACT_ID,
  methodName: "authorize_spend",
  args: { id: mandateId, target: yourContractId, amount: amountYocto },
  gas: 30_000_000_000_000n,
});
// only reached if authorize_spend didn't throw
await account.functionCall({
  contractId: yourContractId,
  methodName: "yourMethod",
  args: { /* ... */ },
  gas: 30_000_000_000_000n,
  attachedDeposit: BigInt(amountYocto),
});`}
                />
              </TerminalSection>

              <TerminalSection id="cli" file="scratch.sh" title="near-cli">
                <p className="text-sm text-zinc-400">
                  For scripting, testing, or a quick manual check against a deployed mandate.
                </p>
                <CodeBlock
                  lang="bash"
                  code={`near call $MANDATE_CONTRACT_ID authorize_spend \\
  '{"id": 0, "target": "'$YOUR_CONTRACT_ID'", "amount": "1000000000000000000000000"}' \\
  --accountId $AGENT_ACCOUNT

near view $MANDATE_CONTRACT_ID get_mandate '{"id": 0}'`}
                />
              </TerminalSection>
            </div>
          </div>

          {/* Plain structured reference below the terminal */}
          <section id="reference" className="flex scroll-mt-24 flex-col gap-4">
            <h2 className="text-sm font-semibold">Mandate contract reference</h2>
            <div className="flex flex-col gap-3">
              {METHODS.map((m) => (
                <Card key={m.name}>
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <CardTitle className="font-mono text-sm">{m.name}</CardTitle>
                      <Badge variant={m.kind === "change" ? "default" : "secondary"} className="text-[10px]">
                        {m.kind}
                      </Badge>
                    </div>
                    <CardDescription className="font-mono text-xs">{m.sig}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">{m.desc}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>

          <section className="flex flex-col gap-2 rounded-xl border border-dashed p-5">
            <h2 className="text-sm font-semibold">Who else is already building on it</h2>
            <p className="text-sm text-muted-foreground">
              <code className="rounded bg-muted px-1 py-0.5 text-xs">contracts/task-market</code> (Hire a Swarm) gates
              every job&apos;s budget through Mandate using only the pattern above — it never imports or calls into
              Mandate beyond that one <code className="rounded bg-muted px-1 py-0.5 text-xs">authorize_spend</code>{" "}
              call. That decoupling is the point: your app can be the second.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}

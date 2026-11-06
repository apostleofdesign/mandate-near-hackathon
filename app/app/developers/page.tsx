// Dev tools: Mandate isn't a feature bolted onto one app — it's a standalone
// permission contract any NEAR app can gate spending through, the same way
// Task Market does. This page is the integration guide.
import { RiToolsLine } from "@remixicon/react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import CodeBlock from "../../components/CodeBlock";
import { NETWORK_ID, MANDATE_CONTRACT_ID, TASK_MARKET_CONTRACT_ID } from "../../lib/near";

const SECTIONS = [
  { href: "#quickstart", label: "Quickstart" },
  { href: "#pattern", label: "The pattern" },
  { href: "#typescript", label: "TypeScript" },
  { href: "#cli", label: "near-cli" },
  { href: "#reference", label: "Contract reference" },
];

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
    desc: "Kill a mandate immediately. Callable by its issuer, or by whatever account was registered as `guard` at deploy time — independent of the issuer, for exactly this reason.",
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
];

export default function DevelopersPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-10 px-6 py-16">
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

      <div className="grid gap-12 lg:grid-cols-[180px_1fr]">
        <nav className="hidden lg:sticky lg:top-20 lg:block lg:h-fit">
          <ul className="flex flex-col gap-1 border-l text-sm">
            {SECTIONS.map((s) => (
              <li key={s.href}>
                <a
                  href={s.href}
                  className="-ml-px block border-l-2 border-transparent px-3 py-1 text-muted-foreground hover:border-foreground/30 hover:text-foreground"
                >
                  {s.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex min-w-0 flex-col gap-12">
      <section id="quickstart" className="flex flex-col gap-4 scroll-mt-20">
        <h2 className="text-sm font-semibold">Quickstart</h2>
        <p className="text-sm text-muted-foreground">Contract IDs for this live {NETWORK_ID} deployment.</p>
        <CodeBlock
          lang="env"
          code={`NEXT_PUBLIC_NEAR_NETWORK=${NETWORK_ID}\nNEXT_PUBLIC_MANDATE_CONTRACT_ID=${MANDATE_CONTRACT_ID}\nNEXT_PUBLIC_TASK_MARKET_CONTRACT_ID=${TASK_MARKET_CONTRACT_ID}`}
        />
      </section>

      <section id="pattern" className="flex flex-col gap-4 scroll-mt-20">
        <h2 className="text-sm font-semibold">The pattern</h2>
        <p className="text-sm text-muted-foreground">
          Mandate never calls into your contract, and your contract never has to know Mandate exists
          at the type level — the caller just does both calls in sequence. If the first one panics,
          the second never runs.
        </p>
        <CodeBlock
          lang="pattern"
          code={`1. authorize_spend(mandate_id, your_contract_id, amount)   // fails closed
2. your_contract.your_method(...)                          // only reached if 1 succeeded`}
        />
      </section>

      <section id="typescript" className="flex flex-col gap-4 scroll-mt-20">
        <h2 className="text-sm font-semibold">TypeScript — near-api-js</h2>
        <p className="text-sm text-muted-foreground">
          The exact pattern <code className="rounded bg-muted px-1 py-0.5 text-xs">agents/src/coordinator.ts</code> uses.
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
      </section>

      <section id="cli" className="flex flex-col gap-4 scroll-mt-20">
        <h2 className="text-sm font-semibold">near-cli</h2>
        <p className="text-sm text-muted-foreground">For scripting, testing, or a quick manual check against a deployed mandate.</p>
        <CodeBlock
          lang="bash"
          code={`near call $MANDATE_CONTRACT_ID authorize_spend \\
  '{"id": 0, "target": "'$YOUR_CONTRACT_ID'", "amount": "1000000000000000000000000"}' \\
  --accountId $AGENT_ACCOUNT

near view $MANDATE_CONTRACT_ID get_mandate '{"id": 0}'`}
        />
      </section>

      <Separator />

      <section id="reference" className="flex flex-col gap-4 scroll-mt-20">
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
          every job's budget through Mandate using only the pattern above — it never imports or calls into Mandate
          beyond that one <code className="rounded bg-muted px-1 py-0.5 text-xs">authorize_spend</code> call. That
          decoupling is the point: your app can be the second.
        </p>
      </section>
        </div>
      </div>
    </main>
  );
}

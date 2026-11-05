// Dev tools: Mandate isn't a feature bolted onto one app — it's a standalone
// permission contract any NEAR app can gate spending through, the same way
// both Checkout and Task Market do. This page is the integration guide.
import { RiToolsLine } from "@remixicon/react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import CodeBlock from "../../components/CodeBlock";

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
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-12 px-6 py-16">
      <div className="flex flex-col gap-2">
        <Badge variant="outline" className="w-fit gap-1.5">
          <RiToolsLine className="size-3.5" />
          Dev tools
        </Badge>
        <h1 className="font-heading text-2xl font-medium tracking-tight">Build on Mandate</h1>
        <p className="max-w-xl text-sm text-muted-foreground">
          Mandate is a standalone NEAR contract, not a Checkout feature. Hire a Swarm and Checkout
          both gate spending through the exact same two calls below — your app can too, instead of
          writing its own spend-limit logic from scratch.
        </p>
      </div>

      <section className="flex flex-col gap-4">
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

      <section className="flex flex-col gap-4">
        <h2 className="text-sm font-semibold">TypeScript — near-api-js</h2>
        <p className="text-sm text-muted-foreground">
          The exact pattern <code className="rounded bg-muted px-1 py-0.5 text-xs">agents/src/shopping-agent.ts</code> and{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">agents/src/coordinator.ts</code> both use.
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

      <section className="flex flex-col gap-4">
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

      <section className="flex flex-col gap-4">
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
          <code className="rounded bg-muted px-1 py-0.5 text-xs">contracts/checkout</code> (merchant payments) and{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">contracts/task-market</code> (Hire a Swarm) are both
          independent contracts that gate spending through Mandate using only the pattern above —
          neither one imports or calls into the other. That decoupling is the point: your app can be the third.
        </p>
      </section>
    </main>
  );
}

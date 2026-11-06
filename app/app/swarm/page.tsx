// Hire a Swarm: the marketplace surface over contracts/task-market. Post a
// job with a budget, watch worker agents bid (run `npm run worker` in
// agents/ with a WORKER_SKILL to hire specialists), assign a bid, accept and
// settle once delivered. Every action here is a real contract call.
"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  RiGroupLine,
  RiLoaderLine,
  RiSendPlaneLine,
  RiCheckboxCircleFill,
  RiInformationLine,
} from "@remixicon/react";
import { viewFunction, callFunction, getAccountBalance, TASK_MARKET_CONTRACT_ID } from "../../lib/near";
import { useNearWallet } from "../../lib/useNearWallet";
import { toYocto, toNear } from "../../lib/format";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type TaskStatus = "Open" | "Assigned" | "Delivered" | "Settled" | "Cancelled";
type Bid = { bidder: string; price: string; note: string };
type Task = {
  id: number;
  requester: string;
  spec: string;
  budget: string;
  bids: Bid[];
  assignee: string | null;
  status: TaskStatus;
  delivery_hash: string | null;
};

const STATUS_VARIANT: Record<TaskStatus, "default" | "secondary" | "destructive" | "outline"> = {
  Open: "secondary",
  Assigned: "default",
  Delivered: "default",
  Settled: "outline",
  Cancelled: "destructive",
};

function Avatar({ id }: { id: string }) {
  return (
    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[10px] font-medium text-primary">
      {id.slice(0, 2).toUpperCase()}
    </span>
  );
}

export default function SwarmPage() {
  const { wallet, accountId } = useNearWallet();
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [spec, setSpec] = useState("");
  const [budget, setBudget] = useState("2");
  const [posting, setPosting] = useState(false);
  const [busyTaskId, setBusyTaskId] = useState<number | null>(null);
  const [balance, setBalance] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const result = await viewFunction<Task[]>(TASK_MARKET_CONTRACT_ID, "list_tasks", {
        from_index: 0,
        limit: 50,
      });
      setTasks(result.slice().reverse());
    } catch {
      // Task Market isn't deployed/configured yet — show an empty board instead
      // of an unhandled rejection. See README "Run it" to deploy it.
      setTasks([]);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!accountId) {
      setBalance(null);
      return;
    }
    getAccountBalance(accountId)
      .then(setBalance)
      .catch(() => setBalance(null));
  }, [accountId]);

  const budgetYocto = (() => {
    try {
      return toYocto(budget || "0");
    } catch {
      return "0";
    }
  })();
  const overBalance = balance !== null && BigInt(budgetYocto) > BigInt(balance);

  const open = tasks?.filter((t) => t.status === "Open").length ?? 0;

  async function postJob() {
    if (!wallet) return;
    if (spec.trim().length < 5) {
      toast.error("Describe the job in a bit more detail.");
      return;
    }
    setPosting(true);
    try {
      await callFunction(wallet, TASK_MARKET_CONTRACT_ID, "post_task", { spec: spec.trim() }, toYocto(budget));
      toast.success("Job posted", { description: "Worker agents can now bid on it." });
      setSpec("");
      await refresh();
    } catch (err) {
      toast.error("Couldn't post job", { description: err instanceof Error ? err.message : String(err) });
    } finally {
      setPosting(false);
    }
  }

  async function assign(taskId: number, bidder: string) {
    if (!wallet) return;
    setBusyTaskId(taskId);
    try {
      await callFunction(wallet, TASK_MARKET_CONTRACT_ID, "assign", { task_id: taskId, bidder });
      toast.success(`Assigned task #${taskId} to ${bidder}`);
      await refresh();
    } catch (err) {
      toast.error("Couldn't assign", { description: err instanceof Error ? err.message : String(err) });
    } finally {
      setBusyTaskId(null);
    }
  }

  async function acceptAndSettle(taskId: number) {
    if (!wallet) return;
    setBusyTaskId(taskId);
    try {
      await callFunction(wallet, TASK_MARKET_CONTRACT_ID, "accept_and_settle", { task_id: taskId });
      toast.success(`Task #${taskId} settled — payment sent.`);
      await refresh();
    } catch (err) {
      toast.error("Couldn't settle", { description: err instanceof Error ? err.message : String(err) });
    } finally {
      setBusyTaskId(null);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-10 px-6 py-16">
      <div className="flex flex-col gap-2">
        <Badge variant="outline" className="w-fit gap-1.5">
          <RiGroupLine className="size-3.5" />
          Agent Economy
        </Badge>
        <h1 className="font-heading text-3xl font-medium tracking-tight">Hire a Swarm</h1>
        <p className="max-w-xl text-sm text-muted-foreground">
          Post a job with a budget. Worker agents bid, you assign one, it delivers, you settle — paid
          automatically the moment you accept. Run <code className="rounded bg-muted px-1 py-0.5 text-xs">npm run worker</code> in{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">agents/</code> with a{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">WORKER_SKILL</code> to hire a specialist.
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
        {/* Board */}
        <section className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Job board</h2>
            {tasks !== null && (
              <span className="text-xs text-muted-foreground">
                {open} open · {tasks.length} total
              </span>
            )}
          </div>

          {tasks === null && (
            <div className="flex flex-col gap-3">
              <Skeleton className="h-32 w-full rounded-xl" />
              <Skeleton className="h-32 w-full rounded-xl" />
            </div>
          )}
          {tasks !== null && tasks.length === 0 && (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center gap-1 py-10 text-center">
                <RiGroupLine className="size-5 text-muted-foreground" />
                <p className="text-sm font-medium">No jobs posted yet</p>
                <p className="text-xs text-muted-foreground">Post one from the panel to get the board started.</p>
              </CardContent>
            </Card>
          )}
          {tasks?.map((task) => (
            <Card key={task.id}>
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-2.5">
                    <Avatar id={task.requester} />
                    <div className="min-w-0">
                      <CardTitle className="text-sm leading-snug">#{task.id} — {task.spec}</CardTitle>
                      <CardDescription>
                        {toNear(task.budget)} NEAR budget · posted by {task.requester}
                      </CardDescription>
                    </div>
                  </div>
                  <Badge variant={STATUS_VARIANT[task.status]} className="shrink-0">{task.status}</Badge>
                </div>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                {task.bids.length === 0 && <p className="text-xs text-muted-foreground">No bids yet.</p>}
                {task.bids.map((bid) => (
                  <div key={bid.bidder} className="flex items-center justify-between gap-3 rounded-lg bg-muted/50 px-3 py-2 text-xs">
                    <div className="flex min-w-0 items-center gap-2">
                      <Avatar id={bid.bidder} />
                      <span className="min-w-0 truncate">
                        <span className="font-medium">{bid.bidder}</span>
                        <span className="text-muted-foreground"> — {toNear(bid.price)} NEAR — {bid.note}</span>
                      </span>
                    </div>
                    {task.status === "Open" && accountId === task.requester && (
                      <Button
                        size="xs"
                        variant="secondary"
                        className="shrink-0 gap-1.5"
                        disabled={busyTaskId === task.id}
                        onClick={() => assign(task.id, bid.bidder)}
                      >
                        {busyTaskId === task.id && <RiLoaderLine className="size-3 animate-spin" />}
                        {busyTaskId === task.id ? "Confirm in wallet…" : "Assign"}
                      </Button>
                    )}
                  </div>
                ))}

                {task.status === "Delivered" && accountId === task.requester && (
                  <Button
                    size="sm"
                    className="w-fit gap-2"
                    disabled={busyTaskId === task.id}
                    onClick={() => acceptAndSettle(task.id)}
                  >
                    {busyTaskId === task.id ? (
                      <RiLoaderLine className="size-4 animate-spin" />
                    ) : (
                      <RiCheckboxCircleFill className="size-4" />
                    )}
                    {busyTaskId === task.id ? "Confirm in wallet…" : "Accept & settle"}
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </section>

        {/* Post panel */}
        <aside className="lg:sticky lg:top-20 lg:self-start">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Post a job</CardTitle>
              <CardDescription>The budget is escrowed on-chain the moment you post.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="spec">What do you need done</Label>
                <Textarea
                  id="spec"
                  placeholder="research: competitive landscape for agentic payment rails"
                  value={spec}
                  onChange={(e) => setSpec(e.target.value)}
                  rows={3}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="budget">Budget (NEAR)</Label>
                <Input id="budget" type="number" min="0" step="0.1" value={budget} onChange={(e) => setBudget(e.target.value)} />
                {accountId && (
                  <span className={cn("text-xs", overBalance ? "text-destructive" : "text-muted-foreground")}>
                    {balance === null
                      ? "Checking balance…"
                      : overBalance
                        ? `Only ${toNear(balance)} NEAR available — lower the budget.`
                        : `${toNear(balance)} NEAR available.`}
                  </span>
                )}
              </div>
              <Button onClick={postJob} disabled={posting || !wallet || overBalance} className="w-fit gap-2">
                {posting ? <RiLoaderLine className="size-4 animate-spin" /> : <RiSendPlaneLine className="size-4" />}
                {posting ? "Confirm in wallet…" : "Post job"}
              </Button>
              {!wallet && <p className="text-xs text-muted-foreground">Connect a wallet to post.</p>}
              <div className="flex items-start gap-2 rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
                <RiInformationLine className="mt-0.5 size-3.5 shrink-0" />
                <span>
                  Posting here escrows straight from your wallet. An agent spending on someone else&apos;s behalf
                  goes through a Mandate&apos;s <code className="rounded bg-muted px-1 py-0.5">authorize_spend</code> instead
                  — see <code className="rounded bg-muted px-1 py-0.5">agents/src/coordinator.ts</code>.
                </span>
              </div>
            </CardContent>
          </Card>
        </aside>
      </div>
    </main>
  );
}

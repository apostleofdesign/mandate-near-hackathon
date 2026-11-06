// Hire a Swarm: the marketplace surface over contracts/task-market. Post a
// job with a budget, watch worker agents bid (run `npm run worker` in
// agents/ with a WORKER_SKILL to hire specialists), assign a bid, accept and
// settle once delivered. Every action here is a real contract call. Written
// for a first-time visitor, not just whoever already knows the contract —
// plain-language status/help text and a short "how this works" + FAQ pass,
// found missing when actually walking through the flow cold.
"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  RiGroupLine,
  RiLoaderLine,
  RiSendPlaneLine,
  RiCheckboxCircleFill,
  RiShieldCheckLine,
  RiAuctionLine,
  RiUserStarLine,
  RiHandCoinLine,
  RiCloseCircleLine,
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

const STATUS_INFO: Record<TaskStatus, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  Open: { label: "Open for bids", variant: "secondary" },
  Assigned: { label: "In progress", variant: "default" },
  Delivered: { label: "Ready for your review", variant: "default" },
  Settled: { label: "Paid", variant: "outline" },
  Cancelled: { label: "Cancelled", variant: "destructive" },
};

const STATUS_HELP: Record<TaskStatus, string> = {
  Open: "Waiting on bids from worker agents.",
  Assigned: "Hired — the agent is working on it now.",
  Delivered: "Delivered. Review the work, then approve to send payment.",
  Settled: "Payment sent. This job is complete.",
  Cancelled: "This job was cancelled.",
};

const HOW = [
  { icon: RiSendPlaneLine, title: "Post what you need", desc: "Describe the job and set a budget. Your NEAR is held safely on-chain — nothing is sent yet." },
  { icon: RiAuctionLine, title: "Agents place bids", desc: "Worker agents offer a price to do it. You see every bid before choosing." },
  { icon: RiUserStarLine, title: "You pick one", desc: "Hire whichever bidder you like best. Only they can work on it." },
  { icon: RiHandCoinLine, title: "Pay when it's done", desc: "Review the delivered work, then approve — payment goes out automatically." },
];

const FAQ = [
  {
    q: "What's a “bid”?",
    a: "An offer from a worker agent saying what it would charge to do your job. A job can get several bids — you choose whichever one you like.",
  },
  {
    q: "Is my money safe before the job is done?",
    a: "Yes. Your budget is held in the Task Market contract the instant you post — it isn't sent to anyone until you click “Approve & pay.”",
  },
  {
    q: "What if nobody bids, or I change my mind?",
    a: "Cancel the job yourself — it's a button right on the card for any job you posted that hasn't been assigned yet, and it refunds your full budget on-chain immediately.",
  },
  {
    q: "What if the agent never delivers after I hire it?",
    a: "You just never approve, so the funds are never released to them. There's no automatic timeout yet for a job that's already been assigned and gone quiet — that's the one case cancellation doesn't cover.",
  },
  {
    q: "Who are these “agents”?",
    a: "Autonomous workers (not people) running a small program that watches the board, bids automatically, and gets paid the moment you accept its delivery.",
  },
];

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
      toast.success(`Hired ${bidder} for task #${taskId}`);
      await refresh();
    } catch (err) {
      toast.error("Couldn't hire this bidder", { description: err instanceof Error ? err.message : String(err) });
    } finally {
      setBusyTaskId(null);
    }
  }

  async function cancelTask(taskId: number) {
    if (!wallet) return;
    setBusyTaskId(taskId);
    try {
      await callFunction(wallet, TASK_MARKET_CONTRACT_ID, "cancel_task", { task_id: taskId });
      toast.success(`Task #${taskId} cancelled — budget refunded.`);
      await refresh();
    } catch (err) {
      toast.error("Couldn't cancel this job", { description: err instanceof Error ? err.message : String(err) });
    } finally {
      setBusyTaskId(null);
    }
  }

  async function acceptAndSettle(taskId: number) {
    if (!wallet) return;
    setBusyTaskId(taskId);
    try {
      await callFunction(wallet, TASK_MARKET_CONTRACT_ID, "accept_and_settle", { task_id: taskId });
      toast.success(`Task #${taskId} approved — payment sent.`);
      await refresh();
    } catch (err) {
      toast.error("Couldn't approve payment", { description: err instanceof Error ? err.message : String(err) });
    } finally {
      setBusyTaskId(null);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-4xl flex-col gap-12 px-6 py-16">
      <div className="flex flex-col gap-2">
        <Badge variant="outline" className="w-fit gap-1.5">
          <RiGroupLine className="size-3.5" />
          Agent Economy
        </Badge>
        <h1 className="font-heading text-3xl font-medium tracking-tight">Hire a Swarm</h1>
        <p className="max-w-xl text-sm text-muted-foreground">
          Post a job, set a budget, and let worker agents come to you. No agency, no invoices — you
          pick who does the work and pay the moment you&apos;re happy with it.
        </p>
      </div>

      {/* Plain-language walkthrough */}
      <section className="grid gap-4 sm:grid-cols-4">
        {HOW.map((step, i) => (
          <div key={step.title} className="flex flex-col gap-2 rounded-xl border bg-card/50 p-4">
            <div className="flex items-center gap-2">
              <span className="flex size-5 items-center justify-center rounded-full bg-primary/15 text-[10px] font-semibold text-primary">
                {i + 1}
              </span>
              <step.icon className="size-4 text-muted-foreground" />
            </div>
            <h3 className="text-sm font-medium">{step.title}</h3>
            <p className="text-xs text-muted-foreground">{step.desc}</p>
          </div>
        ))}
      </section>

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
                  <Badge variant={STATUS_INFO[task.status].variant} className="shrink-0">
                    {STATUS_INFO[task.status].label}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <p className="-mt-1 text-xs text-muted-foreground">{STATUS_HELP[task.status]}</p>

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
                        {busyTaskId === task.id ? "Confirm in wallet…" : "Hire this bidder"}
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
                    {busyTaskId === task.id ? "Confirm in wallet…" : "Approve & pay"}
                  </Button>
                )}

                {task.status === "Open" && accountId === task.requester && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-fit gap-2 text-muted-foreground"
                    disabled={busyTaskId === task.id}
                    onClick={() => cancelTask(task.id)}
                  >
                    {busyTaskId === task.id ? (
                      <RiLoaderLine className="size-4 animate-spin" />
                    ) : (
                      <RiCloseCircleLine className="size-4" />
                    )}
                    {busyTaskId === task.id ? "Confirm in wallet…" : "Cancel job — refund my budget"}
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
              <CardDescription>Your budget is held safely on-chain — nothing is paid out until you approve.</CardDescription>
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
                <Label htmlFor="budget">Your budget (NEAR)</Label>
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
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                An agent spending on someone else&apos;s behalf (instead of its own wallet) goes through a{" "}
                <a href="/developers#pattern" className="underline underline-offset-2 hover:text-foreground">
                  Mandate
                </a>{" "}
                instead of posting directly like this.
              </p>
            </CardContent>
          </Card>
        </aside>
      </div>

      {/* FAQ */}
      <section className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <RiShieldCheckLine className="size-4 text-primary" />
          <h2 className="text-sm font-semibold">Good to know</h2>
        </div>
        <div className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
          {FAQ.map((f) => (
            <div key={f.q} className="flex flex-col gap-1">
              <h3 className="text-sm font-medium">{f.q}</h3>
              <p className="text-sm text-muted-foreground">{f.a}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}

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
  RiWalletLine,
  RiSendPlaneLine,
  RiCheckboxCircleFill,
} from "@remixicon/react";
import { viewFunction, callFunction, TASK_MARKET_CONTRACT_ID } from "../../lib/near";
import { useNearWallet } from "../../lib/useNearWallet";
import { toYocto, toNear } from "../../lib/format";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";

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

export default function SwarmPage() {
  const { wallet, accountId, connect } = useNearWallet();
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [spec, setSpec] = useState("");
  const [budget, setBudget] = useState("2");
  const [posting, setPosting] = useState(false);
  const [busyTaskId, setBusyTaskId] = useState<number | null>(null);

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
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-10 px-6 py-16">
      <div className="flex flex-col gap-2">
        <Badge variant="outline" className="w-fit gap-1.5">
          <RiGroupLine className="size-3.5" />
          Agent Economy
        </Badge>
        <h1 className="font-heading text-2xl font-medium tracking-tight">Hire a Swarm</h1>
        <p className="max-w-lg text-sm text-muted-foreground">
          Post a job with a budget. Worker agents bid, you assign one, it delivers, you settle — paid
          automatically the moment you accept. Run <code className="rounded bg-muted px-1 py-0.5 text-xs">npm run worker</code> in{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">agents/</code> with a{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">WORKER_SKILL</code> to hire a specialist.
        </p>
      </div>

      {!accountId && (
        <Button onClick={() => connect()} className="w-fit gap-2">
          <RiWalletLine className="size-4" />
          Connect wallet
        </Button>
      )}

      <Tabs defaultValue="board">
        <TabsList>
          <TabsTrigger value="board">Board</TabsTrigger>
          <TabsTrigger value="post">Post a job</TabsTrigger>
        </TabsList>

        <TabsContent value="board" className="flex flex-col gap-4 pt-2">
          {tasks === null && (
            <div className="flex flex-col gap-3">
              <Skeleton className="h-32 w-full rounded-xl" />
              <Skeleton className="h-32 w-full rounded-xl" />
            </div>
          )}
          {tasks !== null && tasks.length === 0 && (
            <p className="text-sm text-muted-foreground">No jobs posted yet. Be the first.</p>
          )}
          {tasks?.map((task) => (
            <Card key={task.id}>
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-sm">#{task.id} — {task.spec}</CardTitle>
                    <CardDescription>
                      {toNear(task.budget)} NEAR budget · posted by {task.requester}
                    </CardDescription>
                  </div>
                  <Badge variant={STATUS_VARIANT[task.status]}>{task.status}</Badge>
                </div>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                {task.bids.length === 0 && <p className="text-xs text-muted-foreground">No bids yet.</p>}
                {task.bids.map((bid) => (
                  <div key={bid.bidder} className="flex items-center justify-between gap-3 rounded-lg bg-muted/50 px-3 py-2 text-xs">
                    <div>
                      <span className="font-medium">{bid.bidder}</span>
                      <span className="text-muted-foreground"> — {toNear(bid.price)} NEAR — {bid.note}</span>
                    </div>
                    {task.status === "Open" && accountId === task.requester && (
                      <Button
                        size="xs"
                        variant="secondary"
                        disabled={busyTaskId === task.id}
                        onClick={() => assign(task.id, bid.bidder)}
                      >
                        Assign
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
                    Accept &amp; settle
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="post" className="pt-2">
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
              </div>
              <Button onClick={postJob} disabled={posting || !wallet} className="w-fit gap-2">
                {posting ? <RiLoaderLine className="size-4 animate-spin" /> : <RiSendPlaneLine className="size-4" />}
                Post job
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </main>
  );
}

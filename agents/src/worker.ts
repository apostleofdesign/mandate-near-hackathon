// A specialist worker agent: watches the Task Market for open tasks matching
// its skill, bids, and on assignment delivers the actual work product —
// real contract calls end to end, stored on-chain for the requester to read.
// The work itself comes from a real Gemini inference call (see llm.ts);
// that falls back to a deterministic stub on its own if GEMINI_API_KEY
// isn't set, so this script needs no special-casing.
//
// Usage: NEAR_WORKER_ACCOUNT=researcher.mandate.testnet TASK_MARKET_CONTRACT_ID=market-dev.<you>.testnet WORKER_SKILL=research GEMINI_API_KEY=... npm run worker
import { connectAs } from "./near-client";
import { runInference } from "./llm";

const TASK_MARKET_CONTRACT_ID = process.env.TASK_MARKET_CONTRACT_ID ?? "";
const WORKER_SKILL = process.env.WORKER_SKILL ?? "generic";
const BID_FRACTION_PCT = BigInt(process.env.BID_FRACTION_PCT ?? "80"); // bid 80% of budget by default
const POLL_MS = Number(process.env.POLL_MS ?? "4000");

type TaskStatus = "Open" | "Assigned" | "Delivered" | "Settled" | "Cancelled";
type Task = {
  id: number;
  requester: string;
  spec: string;
  budget: string;
  bids: { bidder: string; price: string; note: string }[];
  assignee: string | null;
  status: TaskStatus;
  delivery_content: string | null;
  delivery_hash: string | null;
};

async function main() {
  const accountId = process.env.NEAR_WORKER_ACCOUNT;
  if (!accountId) throw new Error("set NEAR_WORKER_ACCOUNT");
  if (!TASK_MARKET_CONTRACT_ID) throw new Error("set TASK_MARKET_CONTRACT_ID");
  const near = await connectAs(accountId);
  const account = await near.account(accountId);
  const bidOn = new Set<number>();
  const delivered = new Set<number>();

  console.log(`[worker:${WORKER_SKILL}] ${accountId} watching ${TASK_MARKET_CONTRACT_ID}`);

  while (true) {
    const tasks: Task[] = await account.viewFunction({
      contractId: TASK_MARKET_CONTRACT_ID,
      methodName: "list_tasks",
      args: { from_index: 0, limit: 50 },
    });

    for (const task of tasks) {
      const matchesSkill = task.spec.toLowerCase().includes(WORKER_SKILL.toLowerCase());

      if (task.status === "Open" && matchesSkill && !bidOn.has(task.id)) {
        const price = (BigInt(task.budget) * BID_FRACTION_PCT) / 100n;
        await account.functionCall({
          contractId: TASK_MARKET_CONTRACT_ID,
          methodName: "bid",
          args: { task_id: task.id, price: price.toString(), note: `${WORKER_SKILL} worker bid` },
          gas: 30_000_000_000_000n,
        });
        bidOn.add(task.id);
        console.log(`[worker:${WORKER_SKILL}] bid ${price}y on task #${task.id}: "${task.spec}"`);
      }

      if (task.status === "Assigned" && task.assignee === accountId && !delivered.has(task.id)) {
        const result = await runInference(task.spec);
        // The contract hashes this itself from the content on-chain now — no
        // need to compute or send a hash separately.
        await account.functionCall({
          contractId: TASK_MARKET_CONTRACT_ID,
          methodName: "deliver",
          args: { task_id: task.id, delivery_content: result },
          gas: 30_000_000_000_000n,
        });
        delivered.add(task.id);
        console.log(`[worker:${WORKER_SKILL}] delivered task #${task.id}: ${result.slice(0, 120)}${result.length > 120 ? "…" : ""}`);
      }
    }

    await sleep(POLL_MS);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

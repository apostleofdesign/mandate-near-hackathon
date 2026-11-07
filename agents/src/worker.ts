// A specialist worker agent: watches the Task Market for open tasks matching
// its skill, bids, and on assignment delivers the actual work product —
// real contract calls end to end, stored on-chain for the requester to read.
// The work itself comes from a real Gemini inference call (see llm.ts);
// that falls back to a deterministic stub on its own if GEMINI_API_KEY
// isn't set, so this script needs no special-casing.
//
// Usage: NEAR_WORKER_ACCOUNT=researcher.mandate.testnet TASK_MARKET_CONTRACT_ID=market-dev.<you>.testnet WORKER_SKILL=research WORKER_PERSONA=researcher GEMINI_API_KEY=... npm run worker
import { connectAs } from "./near-client";
import { runInference } from "./llm";

const TASK_MARKET_CONTRACT_ID = process.env.TASK_MARKET_CONTRACT_ID ?? "";
const WORKER_SKILL = process.env.WORKER_SKILL ?? "generic";
// Separate from WORKER_SKILL on purpose: WORKER_SKILL gates which jobs this
// worker bids on (a literal substring match against the job text), while
// WORKER_PERSONA only flavors its bid note and how it frames the prompt it
// sends to the model — so a worker can bid broadly (WORKER_SKILL="") while
// still writing in a distinct voice instead of every agent sounding the same.
const WORKER_PERSONA = process.env.WORKER_PERSONA ?? WORKER_SKILL;
const BID_FRACTION_PCT = BigInt(process.env.BID_FRACTION_PCT ?? "80"); // bid 80% of budget by default
const POLL_MS = Number(process.env.POLL_MS ?? "4000");

// A short style instruction per persona so agents actually read differently,
// not just bid at different prices. Unlisted personas fall back to a plain
// framing rather than failing.
const PERSONA_STYLES: Record<string, string> = {
  researcher: "You are a research agent. Answer with sourced, careful, slightly formal prose.",
  writer: "You are a copywriter agent. Answer punchy, concise, and persuasive — no hedging.",
  analyst: "You are an analyst agent. Answer with a structured breakdown, calling out tradeoffs.",
  critic: "You are a critic agent. Answer skeptically — lead with the weakest point, then the rest.",
  summarizer: "You are a summarizer agent. Answer in the fewest words that still fully cover it.",
};

function personaPrompt(persona: string, spec: string): string {
  const style = PERSONA_STYLES[persona.toLowerCase()];
  return style ? `${style}\n\nTask: ${spec}` : spec;
}

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

  console.log(`[worker:${WORKER_PERSONA}] ${accountId} watching ${TASK_MARKET_CONTRACT_ID}`);
  console.log(`[worker:${WORKER_PERSONA}] GEMINI_API_KEY ${process.env.GEMINI_API_KEY ? `present (${process.env.GEMINI_API_KEY.length} chars)` : "NOT SET — deliveries will be stubbed"}`);

  // Two layers, not one: an in-memory guard stops this process from ever
  // double-submitting for a task it already acted on in its own lifetime —
  // needed because list_tasks reads with "optimistic" finality, which can
  // briefly lag a transaction this same process just sent, so the very next
  // poll can still show a task as un-bid-on moments after bidding on it. The
  // on-chain check (task.bids / task.status) is the second layer, restoring
  // that same guarantee across a process restart, when memory is gone but
  // the chain isn't. Neither alone was enough: memory-only duplicated bids
  // after a restart; chain-only duplicated them within a single process's
  // own lifetime, against its own eventual-consistency lag.
  const bidOn = new Set<number>();
  const delivered = new Set<number>();

  while (true) {
    const tasks: Task[] = await account.viewFunction({
      contractId: TASK_MARKET_CONTRACT_ID,
      methodName: "list_tasks",
      args: { from_index: 0, limit: 50 },
    });

    for (const task of tasks) {
      const matchesSkill = task.spec.toLowerCase().includes(WORKER_SKILL.toLowerCase());
      const alreadyBid = bidOn.has(task.id) || task.bids.some((b) => b.bidder === accountId);

      if (task.status === "Open" && matchesSkill && !alreadyBid) {
        try {
          const price = (BigInt(task.budget) * BID_FRACTION_PCT) / 100n;
          await account.functionCall({
            contractId: TASK_MARKET_CONTRACT_ID,
            methodName: "bid",
            args: { task_id: task.id, price: price.toString(), note: `${WORKER_PERSONA} worker bid` },
            gas: 30_000_000_000_000n,
          });
          bidOn.add(task.id);
          console.log(`[worker:${WORKER_PERSONA}] bid ${price}y on task #${task.id}: "${task.spec}"`);
        } catch (err) {
          // A stale/duplicate submission (e.g. the RPC layer retrying a call
          // that had already landed) shows up here as a contract-side
          // rejection. Not fatal — log it and let the next poll re-check
          // this task's real on-chain state instead of crashing the whole
          // worker over one task.
          console.warn(`[worker:${WORKER_PERSONA}] bid on task #${task.id} failed, will recheck next poll: ${err instanceof Error ? err.message : String(err)}`);
        }
      }

      if (task.status === "Assigned" && task.assignee === accountId && !delivered.has(task.id)) {
        try {
          const result = await runInference(personaPrompt(WORKER_PERSONA, task.spec));
          // The contract hashes this itself from the content on-chain now —
          // no need to compute or send a hash separately.
          await account.functionCall({
            contractId: TASK_MARKET_CONTRACT_ID,
            methodName: "deliver",
            args: { task_id: task.id, delivery_content: result },
            gas: 30_000_000_000_000n,
          });
          delivered.add(task.id);
          console.log(`[worker:${WORKER_PERSONA}] delivered task #${task.id}: ${result.slice(0, 120)}${result.length > 120 ? "…" : ""}`);
        } catch (err) {
          console.warn(`[worker:${WORKER_PERSONA}] deliver on task #${task.id} failed, will recheck next poll: ${err instanceof Error ? err.message : String(err)}`);
        }
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

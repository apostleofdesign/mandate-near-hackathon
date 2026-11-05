// The coordinator agent: holds a Mandate funded by a human, decomposes a
// bounty into subtasks, and sub-bounties each one on the Task Market from
// its own treasury. This is the delegation step that makes it a swarm
// rather than a single agent — the coordinator's mandate caps what it can
// hand out in total, and each sub-bounty is its own on-chain task.
import { connectAs } from "./near-client";

const TASK_MARKET_CONTRACT_ID = process.env.TASK_MARKET_CONTRACT_ID ?? "";
const MANDATE_CONTRACT_ID = process.env.MANDATE_CONTRACT_ID ?? "";
const MANDATE_ID = Number(process.env.MANDATE_ID ?? "0");

type Subtask = { spec: string; budgetYocto: string };

function decompose(bounty: string): Subtask[] {
  // Deterministic on purpose — reproducible without an LLM API key. Swap for
  // a real LLM call to split `bounty` into subtasks dynamically.
  return [
    { spec: `research: ${bounty}`, budgetYocto: "1000000000000000000000000" },
    { spec: `draft: ${bounty}`, budgetYocto: "1000000000000000000000000" },
    { spec: `review: ${bounty}`, budgetYocto: "500000000000000000000000" },
  ];
}

async function main() {
  const accountId = process.env.NEAR_COORDINATOR_ACCOUNT;
  if (!accountId) throw new Error("set NEAR_COORDINATOR_ACCOUNT");
  if (!TASK_MARKET_CONTRACT_ID || !MANDATE_CONTRACT_ID) {
    throw new Error("set TASK_MARKET_CONTRACT_ID, MANDATE_CONTRACT_ID");
  }
  const near = await connectAs(accountId);
  const account = await near.account(accountId);

  const bounty = process.argv[2] ?? "a one-page market research brief";
  const subtasks = decompose(bounty);
  console.log(`[coordinator] ${accountId} decomposed "${bounty}" into ${subtasks.length} subtasks under mandate #${MANDATE_ID}`);

  for (const sub of subtasks) {
    // Fails closed here if the mandate is revoked, expired, over cap, or
    // TASK_MARKET_CONTRACT_ID isn't on its allow-list — same gate every
    // other surface (checkout included) goes through.
    await account.functionCall({
      contractId: MANDATE_CONTRACT_ID,
      methodName: "authorize_spend",
      args: { id: MANDATE_ID, target: TASK_MARKET_CONTRACT_ID, amount: sub.budgetYocto },
      gas: 30_000_000_000_000n,
    });

    const result = await account.functionCall({
      contractId: TASK_MARKET_CONTRACT_ID,
      methodName: "post_task",
      args: { spec: sub.spec },
      gas: 30_000_000_000_000n,
      attachedDeposit: BigInt(sub.budgetYocto),
    });

    console.log(`[coordinator] posted sub-bounty #${parseReturnValue(result)}: "${sub.spec}" budget=${sub.budgetYocto}y`);
  }
}

function parseReturnValue(result: unknown): number {
  const outcome = result as { status?: { SuccessValue?: string } };
  const raw = outcome.status?.SuccessValue;
  if (!raw) throw new Error("post_task did not return a value");
  return JSON.parse(Buffer.from(raw, "base64").toString("utf8"));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

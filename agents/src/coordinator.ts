// The coordinator agent: holds a Mandate funded by a human, decomposes a
// bounty into subtasks, and sub-bounties each one on the Task Market from
// its own treasury. This is the delegation step that makes it a swarm
// rather than a single agent — the coordinator's mandate caps what it can
// hand out in total, and each sub-bounty is its own on-chain task.
import { connectAs } from "./near-client";

const TASK_MARKET_CONTRACT_ID = process.env.TASK_MARKET_CONTRACT_ID ?? "";
const MANDATE_CONTRACT_ID = process.env.MANDATE_CONTRACT_ID ?? "";
const MANDATE_ID = process.env.MANDATE_ID ?? "";

type Subtask = { spec: string; budgetYocto: string };

function decompose(bounty: string): Subtask[] {
  // TODO: replace with an LLM call that splits `bounty` into concrete subtasks.
  // Kept deterministic here so the demo is reproducible without an API key.
  return [
    { spec: `research: ${bounty}`, budgetYocto: "1000000000000000000000000" },
    { spec: `draft: ${bounty}`, budgetYocto: "1000000000000000000000000" },
    { spec: `review: ${bounty}`, budgetYocto: "500000000000000000000000" },
  ];
}

async function main() {
  const accountId = process.env.NEAR_COORDINATOR_ACCOUNT;
  if (!accountId) throw new Error("set NEAR_COORDINATOR_ACCOUNT");
  if (!MANDATE_ID) throw new Error("set MANDATE_ID");
  const near = await connectAs(accountId);
  const account = await near.account(accountId);

  const bounty = process.argv[2] ?? "a one-page market research brief";
  const subtasks = decompose(bounty);
  console.log(`[coordinator] decomposed "${bounty}" into ${subtasks.length} subtasks`);

  for (const sub of subtasks) {
    // TODO: before posting, call MANDATE_CONTRACT_ID.authorize_spend(MANDATE_ID, TASK_MARKET_CONTRACT_ID, budget)
    // then TASK_MARKET_CONTRACT_ID.post_task({ spec: sub.spec }) with that attached deposit.
    console.log(`[coordinator] would post sub-bounty: "${sub.spec}" budget=${sub.budgetYocto}y`);
  }

  void account;
  void TASK_MARKET_CONTRACT_ID;
  void MANDATE_CONTRACT_ID;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

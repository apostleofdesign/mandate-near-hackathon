// A specialist worker agent: watches the Task Market for open tasks it can do,
// bids under its mandate's remaining daily cap, and on assignment calls an LLM
// to produce the deliverable, then delivers a hash of the result.
//
// Usage: NEAR_WORKER_ACCOUNT=researcher.mandate.testnet npm run worker
import { connectAs } from "./near-client";
import { createHash } from "crypto";

const TASK_MARKET_CONTRACT_ID = process.env.TASK_MARKET_CONTRACT_ID ?? "";
const WORKER_SKILL = process.env.WORKER_SKILL ?? "generic";

async function main() {
  const accountId = process.env.NEAR_WORKER_ACCOUNT;
  if (!accountId) throw new Error("set NEAR_WORKER_ACCOUNT");
  const near = await connectAs(accountId);
  const account = await near.account(accountId);

  console.log(`[worker:${WORKER_SKILL}] watching ${TASK_MARKET_CONTRACT_ID} for open tasks...`);

  // TODO: poll get_task / an indexer for TaskStatus::Open tasks matching WORKER_SKILL,
  // call `bid` with a price under the mandate's remaining cap (ask the Mandate
  // registry's get_mandate first), then once assigned, call out to an LLM
  // (e.g. Claude) with the task spec, hash the result, and call `deliver`.

  const exampleSpec = "draft a one-paragraph market summary";
  const exampleResult = await runWork(exampleSpec);
  const hash = createHash("sha256").update(exampleResult).digest("hex");
  console.log(`[worker:${WORKER_SKILL}] would deliver hash ${hash} for: "${exampleSpec}"`);

  void account; // referenced once wired to real contract calls
}

async function runWork(spec: string): Promise<string> {
  // TODO: replace with a real call to an LLM API using the task spec as the prompt.
  return `stub result for: ${spec}`;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

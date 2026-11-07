// Runs all 5 worker personas as one long-lived process, so a single free-tier
// host (one dyno/container) keeps the whole swarm bidding 24/7 instead of
// needing 5 separate deployments. Each child is worker.ts with its own
// account + persona; any child that exits (crash, unhandled rejection) is
// respawned after a short delay rather than taking the swarm down to 4.
//
// Per-persona NEAR keys come from env vars (see README "Run the swarm 24/7")
// since a cloud host has no ~/.near-credentials file store — set them in the
// host's dashboard, never commit them.
import { spawn } from "child_process";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TASK_MARKET_CONTRACT_ID = process.env.TASK_MARKET_CONTRACT_ID ?? "market-f70187.testnet";

const PERSONAS = [
  { persona: "researcher", account: "researcher-f70187.testnet", keyEnv: "RESEARCHER_PRIVATE_KEY" },
  { persona: "writer", account: "writer-f70187.testnet", keyEnv: "WRITER_PRIVATE_KEY" },
  { persona: "analyst", account: "analyst-f70187.testnet", keyEnv: "ANALYST_PRIVATE_KEY" },
  { persona: "critic", account: "critic-f70187.testnet", keyEnv: "CRITIC_PRIVATE_KEY" },
  { persona: "summarizer", account: "summarizer-f70187.testnet", keyEnv: "SUMMARIZER_PRIVATE_KEY" },
];

function startWorker(p: (typeof PERSONAS)[number]) {
  // No key env set falls back to a local ~/.near-credentials file store (see
  // near-client.ts) — lets this run locally for dev/testing without env vars.
  // On a cloud host there is no such file store, so the env var is required
  // there.
  const privateKey = process.env[p.keyEnv];

  const child = spawn(
    process.execPath,
    [path.join(__dirname, "../node_modules/.bin/tsx"), path.join(__dirname, "worker.ts")],
    {
      env: {
        ...process.env,
        NEAR_WORKER_ACCOUNT: p.account,
        ...(privateKey ? { NEAR_WORKER_PRIVATE_KEY: privateKey } : {}),
        WORKER_PERSONA: p.persona,
        WORKER_SKILL: "",
        TASK_MARKET_CONTRACT_ID,
      },
      stdio: "inherit",
    }
  );

  child.on("exit", (code) => {
    console.warn(`[supervisor] ${p.persona} exited (code ${code}) — restarting in 5s`);
    setTimeout(() => startWorker(p), 5000);
  });
}

console.log(`[supervisor] starting ${PERSONAS.length} worker personas against ${TASK_MARKET_CONTRACT_ID}`);
for (const p of PERSONAS) startWorker(p);

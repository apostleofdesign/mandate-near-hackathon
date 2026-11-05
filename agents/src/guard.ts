// The Guard watcher: polls every mandate's spend and revokes the ones whose
// velocity looks wrong, independently of the mandate's issuer. This is the
// live demo of the AI Security & Defense track — the kill switch a human
// does not have to pull manually.
import { connectAs } from "./near-client";

const MANDATE_CONTRACT_ID = process.env.MANDATE_CONTRACT_ID ?? "";
const POLL_MS = Number(process.env.POLL_MS ?? "5000");
// Flag a mandate if it spends more than this fraction of its daily cap in one tick.
const VELOCITY_THRESHOLD_PCT = BigInt(process.env.VELOCITY_THRESHOLD_PCT ?? "50");

type Mandate = {
  id: number;
  owner: string;
  issuer: string;
  daily_cap: string;
  spent_today: string;
  day_index: number;
  allowed_contracts: string[];
  expires_at: number;
  revoked: boolean;
};

const lastSpend = new Map<number, bigint>();

function looksAnomalous(m: Mandate): boolean {
  if (m.revoked) return false;
  const cap = BigInt(m.daily_cap);
  if (cap === 0n) return false;
  const spent = BigInt(m.spent_today);
  const prior = lastSpend.get(m.id) ?? 0n;
  lastSpend.set(m.id, spent);
  const delta = spent > prior ? spent - prior : 0n;
  return (delta * 100n) / cap > VELOCITY_THRESHOLD_PCT;
}

async function main() {
  const accountId = process.env.NEAR_GUARD_ACCOUNT;
  if (!accountId) throw new Error("set NEAR_GUARD_ACCOUNT");
  if (!MANDATE_CONTRACT_ID) throw new Error("set MANDATE_CONTRACT_ID");
  const near = await connectAs(accountId);
  const account = await near.account(accountId);

  console.log(`[guard] ${accountId} watching ${MANDATE_CONTRACT_ID} every ${POLL_MS}ms`);

  while (true) {
    const mandates: Mandate[] = await account.viewFunction({
      contractId: MANDATE_CONTRACT_ID,
      methodName: "list_mandates",
      args: { from_index: 0, limit: 50 },
    });

    for (const m of mandates) {
      if (looksAnomalous(m)) {
        console.log(`[guard] mandate #${m.id} spend velocity over ${VELOCITY_THRESHOLD_PCT}% of cap — revoking`);
        await account.functionCall({
          contractId: MANDATE_CONTRACT_ID,
          methodName: "revoke",
          args: { id: m.id },
          gas: 30_000_000_000_000n,
        });
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

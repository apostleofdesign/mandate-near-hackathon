// The Guard watcher: polls every mandate's spend and revokes the ones whose
// velocity looks wrong, independently of the mandate's issuer. This is the
// live demo of the AI Security & Defense track — the kill switch a human
// does not have to pull manually.
import { connectAs } from "./near-client";

const MANDATE_CONTRACT_ID = process.env.MANDATE_CONTRACT_ID ?? "";
const POLL_MS = 5000;
// Flag a mandate if it spends more than this fraction of its daily cap in one tick.
const VELOCITY_THRESHOLD = 0.5;

type MandateView = {
  id: number;
  daily_cap: string;
  spent_today: string;
  revoked: boolean;
};

const lastSpend = new Map<number, bigint>();

async function checkMandate(view: MandateView): Promise<boolean> {
  if (view.revoked) return false;
  const cap = BigInt(view.daily_cap);
  const spent = BigInt(view.spent_today);
  const prior = lastSpend.get(view.id) ?? 0n;
  lastSpend.set(view.id, spent);
  if (cap === 0n) return false;
  const delta = spent > prior ? spent - prior : 0n;
  const fraction = Number(delta) / Number(cap);
  return fraction > VELOCITY_THRESHOLD;
}

async function main() {
  const accountId = process.env.NEAR_GUARD_ACCOUNT;
  if (!accountId) throw new Error("set NEAR_GUARD_ACCOUNT");
  const near = await connectAs(accountId);
  const account = await near.account(accountId);

  console.log(`[guard] watching mandates on ${MANDATE_CONTRACT_ID} every ${POLL_MS}ms`);

  // TODO: enumerate live mandate ids (via an indexer, or a get_mandates_for_owner
  // view added to the contract), call get_mandate on each, run checkMandate,
  // and call revoke(id) with this account (the registered `guard`) when flagged.
  setInterval(() => {
    console.log("[guard] tick — wire up real mandate ids to go live");
  }, POLL_MS);

  void account;
  void checkMandate;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

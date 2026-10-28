// Starting point for the dashboard: connect a wallet, list mandates and
// open tasks. Replace the placeholder sections as the contracts get deployed —
// see the root README's "Run it" steps for the deploy + env var sequence.
"use client";

import { useEffect, useState } from "react";
import { getWallet, MANDATE_CONTRACT_ID, TASK_MARKET_CONTRACT_ID } from "../lib/near";
import type { WalletConnection } from "near-api-js";

export default function Home() {
  const [wallet, setWallet] = useState<WalletConnection | null>(null);
  const [accountId, setAccountId] = useState<string | null>(null);

  useEffect(() => {
    getWallet().then((w) => {
      setWallet(w);
      setAccountId(w.isSignedIn() ? w.getAccountId() : null);
    });
  }, []);

  return (
    <main style={{ fontFamily: "ui-monospace, monospace", padding: 32, maxWidth: 720 }}>
      <h1>Mandate</h1>
      <p>Policy-governed agent marketplace — NEAR HACKATHON.</p>
      <p>
        Mandate contract: <code>{MANDATE_CONTRACT_ID || "not configured"}</code>
        <br />
        Task Market contract: <code>{TASK_MARKET_CONTRACT_ID || "not configured"}</code>
      </p>
      {accountId ? (
        <p>Signed in as {accountId}.</p>
      ) : (
        <button onClick={() => wallet?.requestSignIn({ contractId: MANDATE_CONTRACT_ID })}>
          Connect wallet
        </button>
      )}
      <section>
        <h2>TODO</h2>
        <ul>
          <li>List mandates for the connected account via get_mandate.</li>
          <li>List open tasks on the Task Market and their bids.</li>
          <li>Live spend-vs-cap bar per mandate, fed by the Guard watcher.</li>
        </ul>
      </section>
    </main>
  );
}

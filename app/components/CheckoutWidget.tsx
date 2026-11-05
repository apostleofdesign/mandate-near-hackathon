// The embeddable checkout widget — the whole point of "Mandate Checkout."
//
// A human pays directly: connect wallet, pick "NEAR" or another chain/asset,
// confirm, done. An AI agent pays under a Mandate: pass `mandateId`, and the
// widget calls `authorize_spend` against it before ever touching the order —
// if the mandate is revoked, expired, or the spend would bust its daily cap,
// the call panics and the checkout simply fails closed. Same component, same
// contract, same UI either way — that's deliberate: a merchant never needs
// to know or care whether the customer behind this screen is a person or an
// agent with a budget.
"use client";

import { useState } from "react";
import type { WalletConnection } from "near-api-js";
import { getQuote, getExecutionStatus, type IntentsQuote } from "../lib/intents";
import { getCheckoutContract, getMandateContract, CHECKOUT_CONTRACT_ID } from "../lib/near";

type PaymentAsset = "NEAR" | "ETH" | "USDC" | "SOL";

type Props = {
  wallet: WalletConnection;
  merchantAccount: string;
  amountYocto: string;
  memo: string;
  /** Pass this when the payer is an agent spending under a capped permission, not a human paying their own funds. */
  mandateId?: number;
  onPaid?: (orderId: number) => void;
};

export default function CheckoutWidget({ wallet, merchantAccount, amountYocto, memo, mandateId, onPaid }: Props) {
  const [asset, setAsset] = useState<PaymentAsset>("NEAR");
  const [step, setStep] = useState<"idle" | "quoting" | "awaiting-deposit" | "authorizing" | "paying" | "done" | "error">("idle");
  const [quote, setQuote] = useState<IntentsQuote | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function startCheckout() {
    setError(null);
    try {
      // Demo simplification: the widget creates the order itself, signed by the
      // customer's own wallet. A real merchant integration creates the order
      // server-side (its own key, tied to the cart/session) and only hands the
      // widget an order id — avoids letting any visitor spam `create_order`.
      const checkout = await getCheckoutContract(wallet);
      // @ts-expect-error near-api-js Contract methods are attached dynamically
      const orderId: number = await checkout.create_order({
        merchant: merchantAccount,
        amount: amountYocto,
        memo,
      });

      if (mandateId !== undefined) {
        setStep("authorizing");
        const mandate = await getMandateContract(wallet);
        // Panics (and throws here) if the mandate is revoked, expired, over its
        // daily cap, or CHECKOUT_CONTRACT_ID isn't on its allow-list — exactly
        // the fail-closed behavior the Security track story depends on.
        // @ts-expect-error same as above
        await mandate.authorize_spend({ id: mandateId, target: CHECKOUT_CONTRACT_ID, amount: amountYocto });
      }

      if (asset === "NEAR") {
        await payDirectly(orderId);
        return;
      }

      setStep("quoting");
      const q = await getQuote({
        originAsset: asset,
        destinationAsset: "NEAR",
        amountOut: amountYocto,
        recipient: wallet.getAccountId(),
      });
      setQuote(q);
      setStep("awaiting-deposit");
      // TODO: poll getExecutionStatus(q.quoteId) until it reports the deposit
      // has settled, then call payDirectly(orderId). Left manual for the demo
      // since it depends on the customer actually sending funds to q.depositAddress.
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStep("error");
    }
  }

  async function payDirectly(orderId: number) {
    setStep("paying");
    const checkout = await getCheckoutContract(wallet);
    // @ts-expect-error same as above
    await checkout.pay_order({ order_id: orderId }, undefined, amountYocto);
    setStep("done");
    onPaid?.(orderId);
  }

  async function confirmIntentsDeposit(orderId: number) {
    if (!quote) return;
    const status = await getExecutionStatus(quote.quoteId);
    if (status.status !== "completed") {
      setError(`deposit not settled yet (status: ${status.status})`);
      return;
    }
    await payDirectly(orderId);
  }

  return (
    <div style={{ border: "1px solid #ccc", borderRadius: 8, padding: 16, maxWidth: 360, fontFamily: "ui-monospace, monospace" }}>
      <p style={{ margin: "0 0 8px", fontWeight: 600 }}>Pay with any wallet, any chain</p>
      {mandateId !== undefined && (
        <p style={{ fontSize: 12, color: "#888" }}>Paying under mandate #{mandateId}</p>
      )}
      <select value={asset} onChange={(e) => setAsset(e.target.value as PaymentAsset)} disabled={step !== "idle"}>
        <option value="NEAR">NEAR (direct)</option>
        <option value="ETH">ETH, via NEAR Intents</option>
        <option value="USDC">USDC, via NEAR Intents</option>
        <option value="SOL">SOL, via NEAR Intents</option>
      </select>
      {step === "idle" && <button onClick={startCheckout} style={{ marginLeft: 8 }}>Pay</button>}
      {step === "quoting" && <p>Getting a quote…</p>}
      {step === "authorizing" && <p>Checking mandate…</p>}
      {step === "awaiting-deposit" && quote && (
        <div>
          <p style={{ fontSize: 12 }}>Send {quote.amountIn} {asset} to:</p>
          <code style={{ fontSize: 11, wordBreak: "break-all" }}>{quote.depositAddress}</code>
          <button onClick={() => confirmIntentsDeposit(0)} style={{ display: "block", marginTop: 8 }}>
            I've sent it
          </button>
        </div>
      )}
      {step === "paying" && <p>Settling…</p>}
      {step === "done" && <p>Paid ✓</p>}
      {step === "error" && <p style={{ color: "crimson" }}>{error}</p>}
    </div>
  );
}

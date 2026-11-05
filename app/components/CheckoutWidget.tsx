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
import { toast } from "sonner";
import {
  RiShieldCheckLine,
  RiLoaderLine,
  RiCheckboxCircleFill,
  RiArrowRightLine,
  RiWalletLine,
} from "@remixicon/react";
import { getQuote, getExecutionStatus, type IntentsQuote } from "../lib/intents";
import { getCheckoutContract, getMandateContract, CHECKOUT_CONTRACT_ID } from "../lib/near";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";

type PaymentAsset = "NEAR" | "ETH" | "USDC" | "SOL";

const ASSET_LABEL: Record<PaymentAsset, string> = {
  NEAR: "NEAR (direct)",
  ETH: "ETH, via NEAR Intents",
  USDC: "USDC, via NEAR Intents",
  SOL: "SOL, via NEAR Intents",
};

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
  const busy = step !== "idle" && step !== "done" && step !== "error";

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
        toast.success("Mandate authorized the spend");
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
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      setStep("error");
      toast.error("Checkout failed", { description: message });
    }
  }

  async function payDirectly(orderId: number) {
    setStep("paying");
    const checkout = await getCheckoutContract(wallet);
    // @ts-expect-error same as above
    await checkout.pay_order({ order_id: orderId }, undefined, amountYocto);
    setStep("done");
    toast.success("Order paid", { description: `Order #${orderId} settled on-chain.` });
    onPaid?.(orderId);
  }

  async function confirmIntentsDeposit(orderId: number) {
    if (!quote) return;
    const status = await getExecutionStatus(quote.quoteId);
    if (status.status !== "completed") {
      setError(`deposit not settled yet (status: ${status.status})`);
      toast.info("Still waiting on deposit", { description: `Status: ${status.status}` });
      return;
    }
    await payDirectly(orderId);
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Pay with any wallet</CardTitle>
          {mandateId !== undefined && (
            <Badge variant="secondary" className="gap-1">
              <RiShieldCheckLine className="size-3.5" />
              Mandate #{mandateId}
            </Badge>
          )}
        </div>
        <CardDescription>Any chain, any asset — settled on NEAR via Intents.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="asset">Pay from</Label>
          <Select value={asset} onValueChange={(v) => setAsset(v as PaymentAsset)} disabled={busy}>
            <SelectTrigger id="asset" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(ASSET_LABEL).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {step === "idle" && (
          <Button onClick={startCheckout} className="w-full gap-2">
            <RiWalletLine className="size-4" />
            Pay
            <RiArrowRightLine className="size-4" />
          </Button>
        )}

        {(step === "quoting" || step === "authorizing" || step === "paying") && (
          <Button disabled className="w-full gap-2">
            <RiLoaderLine className="size-4 animate-spin" />
            {step === "quoting" && "Getting a quote…"}
            {step === "authorizing" && "Checking mandate…"}
            {step === "paying" && "Settling…"}
          </Button>
        )}

        {step === "awaiting-deposit" && quote && (
          <div className="flex flex-col gap-3">
            <Separator />
            <p className="text-sm text-muted-foreground">
              Send <span className="font-medium text-foreground">{quote.amountIn} {asset}</span> to:
            </p>
            <code className="rounded-md bg-muted px-2 py-1.5 text-xs break-all">{quote.depositAddress}</code>
            <Button onClick={() => confirmIntentsDeposit(0)} variant="secondary" className="w-full">
              I've sent it
            </Button>
          </div>
        )}

        {step === "done" && (
          <Alert className="border-primary/30 bg-primary/5">
            <RiCheckboxCircleFill className="size-4 text-primary" />
            <AlertTitle>Paid</AlertTitle>
            <AlertDescription>Settled on-chain — the merchant has received funds.</AlertDescription>
          </Alert>
        )}

        {step === "error" && error && (
          <Alert variant="destructive">
            <AlertTitle>Checkout failed</AlertTitle>
            <AlertDescription className="break-words">{error}</AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}

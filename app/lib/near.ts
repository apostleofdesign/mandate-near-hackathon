// Wallet connection via @hot-labs/near-connect — the current standard. The
// old near-api-js WalletConnection flow redirected to MyNearWallet, which
// stopped accepting new app connections when it was sunset on 31 Oct 2026.
// near-connect opens a wallet-picker (Meteor, HERE, Bitte, etc.) instead.
import { NearConnector } from "@hot-labs/near-connect";
import type { NearWalletBase } from "@hot-labs/near-connect";
import { providers } from "near-api-js";
import type { CodeResult } from "near-api-js/lib/providers/provider";

export type { NearWalletBase };

export const NETWORK_ID = (process.env.NEXT_PUBLIC_NEAR_NETWORK ?? "testnet") as "testnet" | "mainnet";
export const MANDATE_CONTRACT_ID = process.env.NEXT_PUBLIC_MANDATE_CONTRACT_ID ?? "";
export const TASK_MARKET_CONTRACT_ID = process.env.NEXT_PUBLIC_TASK_MARKET_CONTRACT_ID ?? "";

let connectorSingleton: NearConnector | null = null;

export function getConnector(): NearConnector {
  if (!connectorSingleton) {
    connectorSingleton = new NearConnector({ network: NETWORK_ID });
  }
  return connectorSingleton;
}

const provider = new providers.JsonRpcProvider({ url: `https://rpc.${NETWORK_ID}.near.org` });

// View calls need no wallet — read straight off the RPC, same as the agents'
// `Account.viewFunction` but from the browser via raw provider.query.
export async function viewFunction<T>(contractId: string, methodName: string, args: object = {}): Promise<T> {
  const res = await provider.query<CodeResult>({
    request_type: "call_function",
    account_id: contractId,
    method_name: methodName,
    args_base64: btoa(JSON.stringify(args)),
    finality: "optimistic",
  });
  return JSON.parse(new TextDecoder().decode(new Uint8Array(res.result))) as T;
}

// Change calls need a signed-in wallet.
export async function callFunction(
  wallet: NearWalletBase,
  contractId: string,
  methodName: string,
  args: object,
  depositYocto = "0",
  gas = "30000000000000"
) {
  return wallet.signAndSendTransaction({
    receiverId: contractId,
    actions: [{ type: "FunctionCall", params: { methodName, args, gas, deposit: depositYocto } }],
  });
}

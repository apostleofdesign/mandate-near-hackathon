// Wallet connection via @hot-labs/near-connect — the current standard. The
// old near-api-js WalletConnection flow redirected to MyNearWallet, which
// stopped accepting new app connections when it was sunset on 31 Oct 2026.
// near-connect opens a wallet-picker (Meteor, HERE, Bitte, etc.) instead.
import { NearConnector } from "@hot-labs/near-connect";
import type { NearWalletBase } from "@hot-labs/near-connect";
import { providers } from "near-api-js";
import type { AccountView, CodeResult, FinalExecutionOutcome } from "near-api-js/lib/providers/provider";

export type { NearWalletBase };

export const NETWORK_ID = (process.env.NEXT_PUBLIC_NEAR_NETWORK ?? "testnet") as "testnet" | "mainnet";
export const MANDATE_CONTRACT_ID = process.env.NEXT_PUBLIC_MANDATE_CONTRACT_ID ?? "";
export const TASK_MARKET_CONTRACT_ID = process.env.NEXT_PUBLIC_TASK_MARKET_CONTRACT_ID ?? "";

let connectorSingleton: NearConnector | null = null;

export function getConnector(): NearConnector {
  if (!connectorSingleton) {
    connectorSingleton = new NearConnector({
      network: NETWORK_ID,
      // "Ethereum Wallets" bridges through evm-on-near.dev via WalletConnect
      // and lists every EVM extension the browser has installed — on a
      // machine with several (MetaMask, Rabby, Phantom, ...) they compete
      // for window.ethereum and connect silently fails. Not something this
      // app can fix since that flow lives entirely on evm-on-near.dev; the
      // reliable path is a native NEAR wallet, so drop this option instead
      // of leaving a tester to hit the same dead end.
      excludedWallets: ["ethereum-wallets"],
    });
  }
  return connectorSingleton;
}

// The official rpc.<network>.near.org gateway measured 3.5-3.8s per call in
// testing here — FastNEAR's public RPC answers the same JSON-RPC interface
// in well under a second. That gap was most of this app's "slow to load"
// feeling, not React or the network to the browser.
const RPC_URL =
  process.env.NEXT_PUBLIC_NEAR_RPC_URL ??
  (NETWORK_ID === "mainnet" ? "https://rpc.mainnet.fastnear.com" : "https://rpc.testnet.fastnear.com");

const provider = new providers.JsonRpcProvider({ url: RPC_URL });

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

// Yocto-NEAR balance of a live account. Throws for an account that doesn't
// exist yet (e.g. hasn't claimed testnet faucet funds) — callers catch it.
export async function getAccountBalance(accountId: string): Promise<string> {
  const res = await provider.query<AccountView>({
    request_type: "view_account",
    account_id: accountId,
    finality: "optimistic",
  });
  return res.amount;
}

// A change call's own return value (e.g. post_task's new TaskId) — buried a
// few layers into the wallet's FinalExecutionOutcome, this is the same
// decode near-api-js's own providers.getTransactionLastResult does.
export function getFunctionCallResult<T>(outcome: FinalExecutionOutcome): T {
  return providers.getTransactionLastResult(outcome) as T;
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

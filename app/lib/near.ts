// Thin wrapper around near-api-js for the dashboard. Fill in contract ids
// once `contracts/build.sh` output is deployed (see root README "Run it").
import { connect, keyStores, WalletConnection, Contract } from "near-api-js";

export const NETWORK_ID = process.env.NEXT_PUBLIC_NEAR_NETWORK ?? "testnet";
export const MANDATE_CONTRACT_ID = process.env.NEXT_PUBLIC_MANDATE_CONTRACT_ID ?? "";
export const TASK_MARKET_CONTRACT_ID = process.env.NEXT_PUBLIC_TASK_MARKET_CONTRACT_ID ?? "";
export const CHECKOUT_CONTRACT_ID = process.env.NEXT_PUBLIC_CHECKOUT_CONTRACT_ID ?? "";

const CONFIG = {
  networkId: NETWORK_ID,
  nodeUrl: `https://rpc.${NETWORK_ID}.near.org`,
  walletUrl: `https://${NETWORK_ID}.mynearwallet.com`,
  helperUrl: `https://helper.${NETWORK_ID}.near.org`,
};

export async function getWallet(): Promise<WalletConnection> {
  const keyStore = new keyStores.BrowserLocalStorageKeyStore();
  const near = await connect({ ...CONFIG, keyStore });
  return new WalletConnection(near, "mandate");
}

export async function getMandateContract(wallet: WalletConnection) {
  return new Contract(wallet.account(), MANDATE_CONTRACT_ID, {
    viewMethods: ["get_mandate"],
    changeMethods: ["issue_mandate", "authorize_spend", "revoke"],
    useLocalViewExecution: false,
  });
}

export async function getTaskMarketContract(wallet: WalletConnection) {
  return new Contract(wallet.account(), TASK_MARKET_CONTRACT_ID, {
    viewMethods: ["get_task"],
    changeMethods: ["post_task", "bid", "assign", "deliver", "accept_and_settle"],
    useLocalViewExecution: false,
  });
}

export async function getCheckoutContract(wallet: WalletConnection) {
  return new Contract(wallet.account(), CHECKOUT_CONTRACT_ID, {
    viewMethods: ["get_order", "get_merchant"],
    changeMethods: ["register_merchant", "create_order", "pay_order", "cancel_order"],
    useLocalViewExecution: false,
  });
}

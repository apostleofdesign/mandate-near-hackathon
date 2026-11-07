// Shared near-api-js setup for the headless demo agents (no browser wallet).
// Locally these sign with a key file via keyStores.UnencryptedFileSystemKeyStore.
// On a host with no ~/.near-credentials (a cloud worker dyno), set
// NEAR_WORKER_PRIVATE_KEY to that account's full-access private key
// (ed25519:...) instead — an in-memory key store is used for that account id.
import { connect, keyStores, KeyPair, Near } from "near-api-js";
import { homedir } from "os";
import path from "path";

export async function connectAs(accountId: string): Promise<Near> {
  const privateKey = process.env.NEAR_WORKER_PRIVATE_KEY;
  const keyStore = privateKey
    ? new keyStores.InMemoryKeyStore()
    : new keyStores.UnencryptedFileSystemKeyStore(path.join(homedir(), ".near-credentials"));
  const networkId = process.env.NEAR_NETWORK ?? "testnet";
  if (privateKey) {
    await keyStore.setKey(networkId, accountId, KeyPair.fromString(privateKey as any));
  }
  // FastNEAR's public RPC answers the same JSON-RPC interface several times
  // faster than rpc.<network>.near.org in practice — matters for the Guard's
  // poll loop and for the worker/coordinator's responsiveness.
  const nodeUrl = process.env.NEAR_RPC_URL ?? `https://rpc.${networkId}.fastnear.com`;
  return connect({
    networkId,
    keyStore,
    nodeUrl,
  });
}

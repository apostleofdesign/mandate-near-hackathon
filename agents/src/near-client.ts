// Shared near-api-js setup for the headless demo agents (no browser wallet —
// these sign with a local key file via keyStores.UnencryptedFileSystemKeyStore).
import { connect, keyStores, Near } from "near-api-js";
import { homedir } from "os";
import path from "path";

export async function connectAs(_accountId: string): Promise<Near> {
  const keyStore = new keyStores.UnencryptedFileSystemKeyStore(
    path.join(homedir(), ".near-credentials")
  );
  const networkId = process.env.NEAR_NETWORK ?? "testnet";
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

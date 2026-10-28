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
  return connect({
    networkId,
    keyStore,
    nodeUrl: `https://rpc.${networkId}.near.org`,
  });
}

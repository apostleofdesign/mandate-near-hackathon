"use client";

import { useCallback, useEffect, useState } from "react";
import type { EventMap, NearWalletBase } from "@hot-labs/near-connect";
import { getConnector } from "./near";

export function useNearWallet() {
  const [wallet, setWallet] = useState<NearWalletBase | null>(null);
  const [accountId, setAccountId] = useState<string | null>(null);

  useEffect(() => {
    const connector = getConnector();

    connector
      .getConnectedWallet()
      .then(({ wallet, accounts }) => {
        setWallet(wallet);
        setAccountId(accounts[0]?.accountId ?? null);
      })
      .catch(() => {
        // No stored session — stays signed out until connect() is called.
      });

    const onSignIn = (payload: EventMap["wallet:signIn"]) => {
      setWallet(payload.wallet);
      setAccountId(payload.accounts[0]?.accountId ?? null);
    };
    const onSignOut = () => {
      setWallet(null);
      setAccountId(null);
    };
    connector.on("wallet:signIn", onSignIn);
    connector.on("wallet:signOut", onSignOut);
    return () => {
      connector.off("wallet:signIn", onSignIn);
      connector.off("wallet:signOut", onSignOut);
    };
  }, []);

  const connect = useCallback(async () => {
    await getConnector().connect();
  }, []);

  const disconnect = useCallback(async () => {
    if (wallet) await getConnector().disconnect(wallet);
  }, [wallet]);

  return { wallet, accountId, connect, disconnect };
}

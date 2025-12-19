"use client";

import { isBitcoinWallet } from "@dynamic-labs/bitcoin";
import { useDynamicContext } from "@dynamic-labs/sdk-react-core";
import { useQuery } from "@tanstack/react-query";

export function useWalletBalance() {
  const { primaryWallet } = useDynamicContext();

  return useQuery({
    queryKey: ["btc-wallet-balance", primaryWallet?.address],
    queryFn: async (): Promise<number | null> => {
      if (!primaryWallet || !isBitcoinWallet(primaryWallet)) return null;
      const balance = await primaryWallet.getBalance();
      return typeof balance === "number" ? balance : Number(balance);
    },
    enabled: !!primaryWallet,
    refetchInterval: 30000,
  });
}

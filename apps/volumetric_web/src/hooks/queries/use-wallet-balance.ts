"use client";

import { isBitcoinWallet } from "@dynamic-labs/bitcoin";
import { useDynamicContext } from "@dynamic-labs/sdk-react-core";
import { useQuery } from "@tanstack/react-query";
import { parseBtcToSats } from "@/lib/utils";

export function useWalletBalance() {
  const { primaryWallet } = useDynamicContext();

  return useQuery({
    queryKey: ["btc-wallet-balance", primaryWallet?.address],
    queryFn: async (): Promise<number | null> => {
      if (!primaryWallet || !isBitcoinWallet(primaryWallet)) return null;

      const rawBalance = await primaryWallet.getBalance();
      if (rawBalance === undefined || rawBalance === null) return null;

      return parseBtcToSats(String(rawBalance).trim());
    },
    enabled: !!primaryWallet,
    refetchInterval: 30000,
  });
}

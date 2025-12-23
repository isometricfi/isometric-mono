"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { QueryKey } from "@/lib/query-keys";
import { useBtcAddress } from "../queries/use-btc-address";

export function useSyncDeposit() {
  const address = useBtcAddress("payment");
  const queryClient = useQueryClient();

  return useMutation<void, Error, void>({
    mutationFn: async (): Promise<void> => {
      if (!address) {
        throw new Error("Wallet not connected");
      }

      const response = await fetch("/api/account/sync-balance/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || data.error || "Failed to check for deposits");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QueryKey.AccountInfo] });
    },
  });
}

"use client";

import { useDynamicContext } from "@dynamic-labs/sdk-react-core";
import { useQuery } from "@tanstack/react-query";
import type { DepositAddressResponse } from "@/app/api/account/deposit-address/types";
import { QueryKey } from "@/lib/query-keys";
import { useBtcAddress } from "./use-btc-address";

export function useDepositAddress() {
  const { primaryWallet } = useDynamicContext();
  const address = useBtcAddress("payment");

  return useQuery<DepositAddressResponse>({
    queryKey: [QueryKey.DepositAddress, address],
    queryFn: async () => {
      if (!address) {
        throw new Error("No address available");
      }

      const response = await fetch("/api/account/deposit-address", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address }),
      });

      if (!response.ok) {
        throw new Error("Failed to fetch deposit address");
      }

      return response.json();
    },
    enabled: !!primaryWallet && !!address,
    staleTime: 300_000, // 5 min
  });
}

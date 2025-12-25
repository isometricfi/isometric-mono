"use client";

import { useQuery } from "@tanstack/react-query";
import superjson from "superjson";
import type { AccountResponse } from "@/app/api/account/types";
import { QueryKey } from "@/lib/query-keys";
import { useBtcAddress } from "./use-btc-address";

export type AccountData = AccountResponse;

export function useAccount() {
  const address = useBtcAddress("payment");

  return useQuery({
    queryKey: [QueryKey.AccountInfo, address],
    queryFn: async (): Promise<AccountData | null> => {
      if (!address) return null;

      const response = await fetch("/api/account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address }),
      });

      if (!response.ok) {
        throw new Error("Failed to fetch account data");
      }

      const text = await response.text();
      return superjson.parse<AccountResponse>(text);
    },
    enabled: !!address,
    refetchInterval: 30000,
  });
}

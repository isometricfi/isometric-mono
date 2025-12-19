"use client";

import { useQuery } from "@tanstack/react-query";
import type { AccountResponse } from "@/app/api/account/route";
import { QueryKey } from "@/lib/query-keys";
import { useBtcAddress } from "./use-btc-address";

export type AccountData = {
  profile: {
    address: string;
    username: string | null;
    principal: string;
  } | null;
  balance: {
    total: bigint;
    available: bigint;
    locked: bigint;
  } | null;
};

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

      const data: AccountResponse = await response.json();

      if (!response.ok) {
        throw new Error("Failed to fetch account data");
      }

      return {
        profile: data.profile,
        balance: data.balance
          ? {
              total: BigInt(data.balance.total),
              available: BigInt(data.balance.available),
              locked: BigInt(data.balance.locked),
            }
          : null,
      };
    },
    enabled: !!address,
    refetchInterval: 30000,
  });
}

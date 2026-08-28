"use client";

import { useQuery } from "@tanstack/react-query";
import type { Output as GetAccountOutput } from "@/lib/use-cases/account/get-account/schema";
import { getAccount } from "@/lib/use-cases/account/get-account/usecase";
import { useBtcAddress } from "./use-btc-address";

export type AccountData = GetAccountOutput;

export function useAccount() {
  const address = useBtcAddress("payment");

  return useQuery({
    queryKey: ["account", address],
    queryFn: () => getAccount(address),
    enabled: !!address,
    refetchInterval: 30000,
  });
}

"use client";

import { useQuery } from "@tanstack/react-query";
import type { Output as GetAccountOutput } from "@/lib/use-cases/account/get-account/schema";
import { useTRPC } from "@/trpc/react";
import { useBtcAddress } from "./use-btc-address";

export type AccountData = GetAccountOutput;

export function useAccount() {
  const trpc = useTRPC();
  const address = useBtcAddress("payment");

  return useQuery({
    ...trpc.account.getAccount.queryOptions({ address: address ?? "" }),
    enabled: !!address,
    refetchInterval: 30000,
  });
}

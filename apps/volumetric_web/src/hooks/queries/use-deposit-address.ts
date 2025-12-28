"use client";

import { useDynamicContext } from "@dynamic-labs/sdk-react-core";
import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/react";
import { useBtcAddress } from "./use-btc-address";

export function useDepositAddress() {
  const trpc = useTRPC();
  const { primaryWallet } = useDynamicContext();
  const address = useBtcAddress("payment");

  return useQuery({
    ...trpc.account.getDepositAddress.queryOptions({ address: address ?? "" }),
    enabled: !!primaryWallet && !!address,
    staleTime: 300_000, // 5 min
  });
}

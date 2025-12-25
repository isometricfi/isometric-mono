"use client";

import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/react";
import { useBtcAddress } from "./use-btc-address";

export function usePortfolio() {
  const trpc = useTRPC();
  const address = useBtcAddress("payment");

  return useQuery({
    ...trpc.portfolio.getPortfolio.queryOptions({ address: address ?? "" }),
    enabled: !!address,
    refetchInterval: 30000,
  });
}

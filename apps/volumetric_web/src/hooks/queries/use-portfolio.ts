"use client";

import { trpc } from "@/lib/trpc";
import { useBtcAddress } from "./use-btc-address";

export function usePortfolio() {
  const address = useBtcAddress("payment");

  return trpc.portfolio.get.useQuery(
    { address: address ?? "" },
    {
      enabled: !!address,
      refetchInterval: 30000,
    },
  );
}

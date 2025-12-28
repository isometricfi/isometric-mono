"use client";

import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/react";
import { useBtcAddress } from "./use-btc-address";

export function useHistory() {
  const trpc = useTRPC();
  const address = useBtcAddress("payment");

  return useQuery({
    ...trpc.history.getHistory.queryOptions({ address: address ?? "" }),
    enabled: !!address,
  });
}

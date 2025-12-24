"use client";

import { trpc } from "@/lib/trpc";
import { useBtcAddress } from "./use-btc-address";

export function useAccount() {
  const address = useBtcAddress("payment");

  return trpc.account.get.useQuery(
    { address: address ?? "" },
    {
      enabled: !!address,
      refetchInterval: 30000,
    },
  );
}

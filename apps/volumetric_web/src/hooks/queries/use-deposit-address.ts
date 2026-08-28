"use client";

import { useQuery } from "@tanstack/react-query";
import { getDepositAddress } from "@/lib/use-cases/account/get-deposit-address/usecase";
import { useBtcAddress } from "./use-btc-address";

export function useDepositAddress() {
  const address = useBtcAddress("payment");

  return useQuery({
    queryKey: ["deposit-address", address],
    queryFn: () => getDepositAddress(address),
    enabled: !!address,
    staleTime: 300_000, // 5 min
  });
}

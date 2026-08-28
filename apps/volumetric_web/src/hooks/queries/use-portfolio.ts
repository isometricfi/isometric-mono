"use client";

import { useQuery } from "@tanstack/react-query";
import { getPortfolio } from "@/lib/use-cases/portfolio/get-portfolio/usecase";
import { useBtcAddress } from "./use-btc-address";

export function usePortfolio() {
  const address = useBtcAddress("payment");

  return useQuery({
    queryKey: ["portfolio", address],
    queryFn: () => getPortfolio(address),
    enabled: !!address,
    refetchInterval: 30000,
  });
}

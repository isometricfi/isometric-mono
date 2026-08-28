"use client";

import { useQuery } from "@tanstack/react-query";
import { getHistory } from "@/lib/use-cases/history/get-history/usecase";
import { useAccount } from "./use-account";

export function useHistory() {
  const { data: account, isLoading: isAccountLoading } = useAccount();
  const principal = account?.profile?.principal;

  const query = useQuery({
    queryKey: ["history", principal],
    queryFn: () => getHistory(principal ?? ""),
    enabled: !!principal,
  });

  return {
    ...query,
    isLoading: isAccountLoading || query.isLoading,
  };
}

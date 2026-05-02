"use client";

import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/react";
import { useAccount } from "./use-account";

export function useHistory() {
  const trpc = useTRPC();
  const { data: account, isLoading: isAccountLoading } = useAccount();
  const principal = account?.profile?.principal;

  const query = useQuery({
    ...trpc.history.getHistory.queryOptions({ principal: principal ?? "" }),
    enabled: !!principal,
  });

  return {
    ...query,
    isLoading: isAccountLoading || query.isLoading,
  };
}

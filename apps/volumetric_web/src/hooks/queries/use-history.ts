"use client";

import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/react";
import { useAccount } from "./use-account";

export function useHistory() {
  const trpc = useTRPC();
  const { data: account } = useAccount();
  const principal = account?.profile?.principal;

  return useQuery({
    ...trpc.history.getHistory.queryOptions({ principal: principal ?? "" }),
    enabled: !!principal,
  });
}

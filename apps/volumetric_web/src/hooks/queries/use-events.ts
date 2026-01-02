"use client";

import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/react";
import { useAccount } from "./use-account";

export function useMyEvents(afterId?: string, limit?: number) {
  const trpc = useTRPC();
  const { data: account } = useAccount();
  const principal = account?.profile?.principal;

  return useQuery({
    ...trpc.events.getForPrincipal.queryOptions({
      principal: principal ?? "",
      afterId,
      limit,
    }),
    enabled: !!principal,
    staleTime: 10000,
  });
}

export function useAllEvents(afterId?: string, limit?: number) {
  const trpc = useTRPC();
  return useQuery({
    ...trpc.events.getAll.queryOptions({ afterId, limit }),
    staleTime: 10000,
  });
}

export function useEventsSince(timestampMs: number, limit?: number) {
  const trpc = useTRPC();
  return useQuery({
    ...trpc.events.getSince.queryOptions({ timestampMs, limit }),
    staleTime: 10000,
  });
}

export function useEventsForPrincipal(principal: string, afterId?: string, limit?: number) {
  const trpc = useTRPC();
  return useQuery({
    ...trpc.events.getForPrincipal.queryOptions({ principal, afterId, limit }),
    enabled: !!principal,
    staleTime: 10000,
  });
}

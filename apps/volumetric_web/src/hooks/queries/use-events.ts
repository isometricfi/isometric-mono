"use client";

import { useQuery } from "@tanstack/react-query";
import {
  getEvents,
  getEventsForPrincipal,
  getEventsSince,
} from "@/lib/use-cases/events/get-events/usecase";
import { useAccount } from "./use-account";

export function useMyEvents(afterId?: string, limit?: number) {
  const { data: account } = useAccount();
  const principal = account?.profile?.principal;

  return useQuery({
    queryKey: ["events", "principal", principal, afterId, limit],
    queryFn: () => getEventsForPrincipal(principal ?? "", afterId, limit),
    enabled: !!principal,
    staleTime: 10000,
  });
}

export function useAllEvents(afterId?: string, limit?: number) {
  return useQuery({
    queryKey: ["events", "all", afterId, limit],
    queryFn: () => getEvents({ afterId, limit }),
    staleTime: 10000,
  });
}

export function useEventsSince(timestampMs: number, limit?: number) {
  return useQuery({
    queryKey: ["events", "since", timestampMs, limit],
    queryFn: () => getEventsSince(timestampMs, limit),
    staleTime: 10000,
  });
}

export function useEventsForPrincipal(principal: string, afterId?: string, limit?: number) {
  return useQuery({
    queryKey: ["events", "principal", principal, afterId, limit],
    queryFn: () => getEventsForPrincipal(principal, afterId, limit),
    enabled: !!principal,
    staleTime: 10000,
  });
}

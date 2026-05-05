"use client";

import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/react";

export function usePauseMode() {
  const trpc = useTRPC();
  return useQuery({
    ...trpc.featureFlags.getPauseMode.queryOptions(),
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });
}

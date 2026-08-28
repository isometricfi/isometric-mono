"use client";

import { useQuery } from "@tanstack/react-query";
import { getPauseMode } from "@/lib/use-cases/feature-flags/get-pause-mode/usecase";

export function usePauseMode() {
  return useQuery({
    queryKey: ["pause-mode"],
    queryFn: getPauseMode,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });
}

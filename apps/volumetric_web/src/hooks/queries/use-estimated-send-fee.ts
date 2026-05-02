"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchEstimatedSendFeeReserveSats } from "@/lib/mempool-client-browser";

export function useEstimatedFeeReserveSats() {
  return useQuery({
    queryKey: ["estimated-fee-reserve-sats"],
    queryFn: fetchEstimatedSendFeeReserveSats,
    staleTime: 60_000,
    refetchInterval: 60_000,
  });
}

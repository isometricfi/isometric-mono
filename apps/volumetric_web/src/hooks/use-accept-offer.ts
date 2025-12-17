"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { AcceptOffersResponse } from "@/app/api/canister/accept-offers/route";
import { QueryKey } from "@/lib/query-keys";
import { useBtcAddress } from "./use-btc-address";

export interface AcceptOfferParams {
  offerId: string;
  quantitySats: number;
}

export function useAcceptOffer() {
  const address = useBtcAddress("payment");
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      offerId,
      quantitySats,
    }: AcceptOfferParams): Promise<AcceptOffersResponse> => {
      if (!address) {
        throw new Error("Wallet not connected");
      }

      const response = await fetch("/api/canister/accept-offers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          walletAddress: address,
          items: [{ offerId, quantity: quantitySats.toString() }],
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || data.error || "Failed to accept offer");
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QueryKey.Options] });
      queryClient.invalidateQueries({ queryKey: [QueryKey.OpenOffers] });
    },
  });
}

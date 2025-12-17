"use client";

import { isBitcoinWallet } from "@dynamic-labs/bitcoin";
import { useDynamicContext } from "@dynamic-labs/sdk-react-core";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { CreateOfferResponse } from "@/app/api/canister/create-offer/route";
import { QueryKey } from "@/lib/query-keys";
import { useBtcAddress } from "./use-btc-address";
import { useCanister } from "./use-canister";

const ONE_DAY_NS = BigInt(86400) * BigInt(1_000_000_000);
const SECONDS_PER_DAY = 86400;
const PERCENT_TO_BASIS_POINTS = 100;

export interface CreateOfferParams {
  quantitySats: number;
  strikePercent: number;
  premiumPercent: number;
  termDays: number;
}

export function useCreateOffer() {
  const { primaryWallet } = useDynamicContext();
  const canister = useCanister();
  const address = useBtcAddress("payment");
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      quantitySats,
      strikePercent,
      premiumPercent,
      termDays,
    }: CreateOfferParams): Promise<CreateOfferResponse> => {
      if (!canister || !address) {
        throw new Error("Wallet not connected");
      }
      if (!primaryWallet || !isBitcoinWallet(primaryWallet)) {
        throw new Error("Bitcoin wallet not connected");
      }

      const quantity = BigInt(quantitySats);
      const strikeBasisPoints = Math.round(strikePercent * PERCENT_TO_BASIS_POINTS);
      const premiumBasisPoints = Math.round(premiumPercent * PERCENT_TO_BASIS_POINTS);
      const optionDurationSeconds = BigInt(termDays * SECONDS_PER_DAY);

      const message = await canister.get_create_offer_message(
        address,
        quantity,
        strikeBasisPoints,
        premiumBasisPoints,
      );
      const signature = await primaryWallet.signMessage(message, {
        addressType: "payment",
      });

      if (!signature) {
        throw new Error("Failed to sign message");
      }

      const now = BigInt(Date.now()) * BigInt(1_000_000);
      const offerValidUntil = now + ONE_DAY_NS;

      const response = await fetch("/api/canister/create-offer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address,
          signature,
          quantity: quantity.toString(),
          strikeBasisPoints,
          premiumBasisPoints,
          offerValidUntil: offerValidUntil.toString(),
          optionDurationSeconds: optionDurationSeconds.toString(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || data.error || "Failed to create offer");
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QueryKey.Options] });
      queryClient.invalidateQueries({ queryKey: [QueryKey.OpenOffers] });
    },
  });
}

"use client";

import { isBitcoinWallet } from "@dynamic-labs/bitcoin";
import { useDynamicContext } from "@dynamic-labs/sdk-react-core";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import type { AcceptOffersResponse } from "@/app/api/options/accept/route";
import { QueryKey } from "@/lib/query-keys";
import { useBtcAddress } from "../queries/use-btc-address";
import { useCanister } from "../use-canister";

export type AcceptOfferStep = "idle" | "signing" | "submitting" | "success" | "error";

export interface AcceptOfferParams {
  offerId: string;
  quantitySats: number;
}

export function useAcceptOffer() {
  const { primaryWallet } = useDynamicContext();
  const canister = useCanister();
  const address = useBtcAddress("payment");
  const queryClient = useQueryClient();

  const [step, setStep] = useState<AcceptOfferStep>("idle");

  const mutation = useMutation({
    mutationFn: async ({
      offerId,
      quantitySats,
    }: AcceptOfferParams): Promise<AcceptOffersResponse> => {
      if (!canister || !address) {
        throw new Error("Wallet not connected");
      }
      if (!primaryWallet || !isBitcoinWallet(primaryWallet)) {
        throw new Error("Bitcoin wallet not connected");
      }

      setStep("signing");

      const items = [{ offer_id: BigInt(offerId), quantity: BigInt(quantitySats) }];
      const message = await canister.get_accept_offers_message(address, items);
      const signature = await primaryWallet.signMessage(message, { addressType: "payment" });

      if (!signature) {
        throw new Error("Failed to sign message");
      }

      setStep("submitting");

      const response = await fetch("/api/options/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address,
          signature,
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
      setStep("success");
      queryClient.invalidateQueries({ queryKey: [QueryKey.Options] });
      queryClient.invalidateQueries({ queryKey: [QueryKey.OpenOffers] });
      queryClient.invalidateQueries({ queryKey: [QueryKey.AccountInfo] });
    },
    onError: () => {
      setStep("error");
    },
  });

  const reset = () => {
    setStep("idle");
    mutation.reset();
  };

  return { ...mutation, step, reset };
}

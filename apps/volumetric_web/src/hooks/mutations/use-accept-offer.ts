"use client";

import { isBitcoinWallet } from "@dynamic-labs/bitcoin";
import { useDynamicContext } from "@dynamic-labs/sdk-react-core";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import type { Output as AcceptOffersOutput } from "@/lib/use-cases/options/accept-offers/schema";
import { trpcClient } from "@/trpc/react";
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
    }: AcceptOfferParams): Promise<AcceptOffersOutput> => {
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

      return trpcClient.options.acceptOffers.mutate({
        address,
        signature,
        items: [{ offerId, quantity: quantitySats.toString() }],
      });
    },
    onSuccess: () => {
      setStep("success");
      queryClient.invalidateQueries({ queryKey: [["options"]] });
      queryClient.invalidateQueries({ queryKey: [["account"]] });
      queryClient.invalidateQueries({ queryKey: [["portfolio"]] });
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

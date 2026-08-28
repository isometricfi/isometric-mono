"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { DEMO_USER_SIGNATURE } from "@/lib/demo/demo-canister-browser";
import { computeExpiresAtSeconds } from "@/lib/use-cases/_shared/wallet-proof";
import type { Output as AcceptOffersOutput } from "@/lib/use-cases/options/accept-offers/schema";
import { acceptOffers } from "@/lib/use-cases/options/accept-offers/usecase";
import { useBtcAddress } from "../queries/use-btc-address";

export type AcceptOfferStep = "idle" | "signing" | "submitting" | "success" | "error";

export interface AcceptOfferParams {
  offerId: string;
  quantitySats: number;
}

export function useAcceptOffer() {
  const address = useBtcAddress("payment");
  const queryClient = useQueryClient();

  const [step, setStep] = useState<AcceptOfferStep>("idle");

  const mutation = useMutation({
    mutationFn: async ({
      offerId,
      quantitySats,
    }: AcceptOfferParams): Promise<AcceptOffersOutput> => {
      if (!address) {
        throw new Error("Demo account not ready");
      }

      const expiresAtSeconds = computeExpiresAtSeconds();
      setStep("submitting");

      return acceptOffers({
        address,
        signature: DEMO_USER_SIGNATURE,
        expiresAtSeconds: expiresAtSeconds.toString(),
        items: [{ offerId, quantity: quantitySats.toString() }],
      });
    },
    onSuccess: () => {
      setStep("success");
      queryClient.invalidateQueries({ queryKey: ["options"] });
      queryClient.invalidateQueries({ queryKey: ["account"] });
      queryClient.invalidateQueries({ queryKey: ["portfolio"] });
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

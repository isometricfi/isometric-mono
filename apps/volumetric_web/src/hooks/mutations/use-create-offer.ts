"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { DEMO_USER_SIGNATURE } from "@/lib/demo/demo-canister-browser";
import { computeExpiresAtSeconds } from "@/lib/use-cases/_shared/wallet-proof";
import { OFFER_VALID_UNTIL_DEFAULT_OFFSET_SECONDS } from "@/lib/use-cases/options/create-offer/offer-valid-until-policy";
import type { Output as CreateOfferOutput } from "@/lib/use-cases/options/create-offer/schema";
import { createOffer } from "@/lib/use-cases/options/create-offer/usecase";
import { useBtcAddress } from "../queries/use-btc-address";

const SECONDS_PER_DAY = 86400;
const PERCENT_TO_BASIS_POINTS = 100;

export type CreateOfferStep = "idle" | "signing" | "submitting" | "success" | "error";

export interface CreateOfferParams {
  quantitySats: number;
  strikePercent: number;
  premiumPercent: number;
  termDays: number;
}

export function useCreateOffer() {
  const address = useBtcAddress("payment");
  const queryClient = useQueryClient();

  const [step, setStep] = useState<CreateOfferStep>("idle");

  const mutation = useMutation({
    mutationFn: async ({
      quantitySats,
      strikePercent,
      premiumPercent,
      termDays,
    }: CreateOfferParams): Promise<CreateOfferOutput> => {
      if (!address) {
        throw new Error("Demo account not ready");
      }

      const quantity = BigInt(quantitySats);
      const strikeBasisPoints = Math.round(strikePercent * PERCENT_TO_BASIS_POINTS);
      const premiumBasisPoints = Math.round(premiumPercent * PERCENT_TO_BASIS_POINTS);
      const optionDurationSeconds = BigInt(termDays * SECONDS_PER_DAY);

      const nowSeconds = BigInt(Math.floor(Date.now() / 1000));
      const offerValidUntilSeconds = nowSeconds + OFFER_VALID_UNTIL_DEFAULT_OFFSET_SECONDS;
      const expiresAtSeconds = computeExpiresAtSeconds();

      setStep("submitting");

      return createOffer({
        address,
        signature: DEMO_USER_SIGNATURE,
        expiresAtSeconds: expiresAtSeconds.toString(),
        quantity: quantity.toString(),
        strikeBasisPoints,
        premiumBasisPoints,
        offerValidUntilSeconds: offerValidUntilSeconds.toString(),
        optionDurationSeconds: optionDurationSeconds.toString(),
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

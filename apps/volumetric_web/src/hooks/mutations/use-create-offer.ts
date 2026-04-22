"use client";

import { isBitcoinWallet } from "@dynamic-labs/bitcoin";
import { useDynamicContext } from "@dynamic-labs/sdk-react-core";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { unwrapResult } from "@volumetric/canister-types";
import { useState } from "react";
import { computeExpiresAtSeconds } from "@/lib/use-cases/_shared/wallet-proof";
import type { Output as CreateOfferOutput } from "@/lib/use-cases/options/create-offer/schema";
import { trpcClient } from "@/trpc/react";
import { useBtcAddress } from "../queries/use-btc-address";
import { useCanister } from "../use-canister";

const TEN_YEARS_NS = BigInt(86400) * BigInt(1_000_000_000) * BigInt(365 * 10);
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
  const { primaryWallet } = useDynamicContext();
  const canister = useCanister();
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
      if (!canister || !address) {
        throw new Error("Wallet not connected");
      }
      if (!primaryWallet || !isBitcoinWallet(primaryWallet)) {
        throw new Error("Bitcoin wallet not connected");
      }

      setStep("signing");

      const quantity = BigInt(quantitySats);
      const strikeBasisPoints = Math.round(strikePercent * PERCENT_TO_BASIS_POINTS);
      const premiumBasisPoints = Math.round(premiumPercent * PERCENT_TO_BASIS_POINTS);
      const optionDurationSeconds = BigInt(termDays * SECONDS_PER_DAY);

      const now = BigInt(Date.now()) * BigInt(1_000_000);
      const offerValidUntil = now + TEN_YEARS_NS;
      const expiresAtSeconds = computeExpiresAtSeconds();

      const message = unwrapResult(
        await canister.get_create_offer_message(
          address,
          quantity,
          strikeBasisPoints,
          premiumBasisPoints,
          optionDurationSeconds,
          offerValidUntil,
          expiresAtSeconds,
        ),
      );
      const signature = await primaryWallet.signMessage(message, { addressType: "payment" });

      if (!signature) {
        throw new Error("Failed to sign message");
      }

      setStep("submitting");

      return trpcClient.options.createOffer.mutate({
        address,
        signature,
        expiresAtSeconds: expiresAtSeconds.toString(),
        quantity: quantity.toString(),
        strikeBasisPoints,
        premiumBasisPoints,
        offerValidUntil: offerValidUntil.toString(),
        optionDurationSeconds: optionDurationSeconds.toString(),
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

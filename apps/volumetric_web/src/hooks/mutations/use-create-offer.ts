"use client";

import { isBitcoinWallet } from "@dynamic-labs/bitcoin";
import { useDynamicContext } from "@dynamic-labs/sdk-react-core";
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { getErrorMessage, nowNs } from "@/lib/utils";
import { useBtcAddress } from "../queries/use-btc-address";
import { useCanister } from "../use-canister";

const TEN_YEARS_NS = BigInt(86400) * BigInt(1_000_000_000) * BigInt(365 * 10);
const SECONDS_PER_DAY = 86400;
const PERCENT_TO_BASIS_POINTS = 100;

export type CreateOfferStep = "idle" | "signing" | "submitting" | "success" | "error";

export interface CreateOfferParams {
  quantitySats: bigint;
  strikePercent: number;
  premiumPercent: number;
  termDays: number;
}

export function useCreateOffer() {
  const { primaryWallet } = useDynamicContext();
  const canister = useCanister();
  const address = useBtcAddress("payment");
  const utils = trpc.useUtils();

  const [step, setStep] = useState<CreateOfferStep>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const mutation = trpc.options.create.useMutation({
    onSuccess: () => {
      setStep("success");
      setErrorMessage(null);
      utils.options.list.invalidate();
      utils.account.get.invalidate();
      utils.portfolio.get.invalidate();
    },
    onError: (error) => {
      setStep("error");
      setErrorMessage(error.message);
    },
  });

  const mutateAsync = async ({
    quantitySats,
    strikePercent,
    premiumPercent,
    termDays,
  }: CreateOfferParams) => {
    try {
      if (!canister || !address) {
        throw new Error("Wallet not connected");
      }
      if (!primaryWallet || !isBitcoinWallet(primaryWallet)) {
        throw new Error("Bitcoin wallet not connected");
      }

      setStep("signing");

      const strikeBasisPoints = Math.round(strikePercent * PERCENT_TO_BASIS_POINTS);
      const premiumBasisPoints = Math.round(premiumPercent * PERCENT_TO_BASIS_POINTS);
      const optionDurationSeconds = BigInt(termDays * SECONDS_PER_DAY);

      const message = await canister.get_create_offer_message(
        address,
        quantitySats,
        strikeBasisPoints,
        premiumBasisPoints,
      );
      const signature = await primaryWallet.signMessage(message, { addressType: "payment" });

      if (!signature) {
        throw new Error("User canceled request");
      }

      setStep("submitting");

      const offerValidUntil = nowNs() + TEN_YEARS_NS;

      return mutation.mutateAsync({
        address,
        signature,
        quantity: quantitySats,
        strikeBasisPoints,
        premiumBasisPoints,
        offerValidUntil,
        optionDurationSeconds,
      });
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
      setStep("error");
      throw error;
    }
  };

  const reset = () => {
    setStep("idle");
    setErrorMessage(null);
    mutation.reset();
  };

  return {
    ...mutation,
    mutateAsync,
    step,
    errorMessage,
    reset,
  };
}

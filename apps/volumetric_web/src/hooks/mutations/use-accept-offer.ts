"use client";

import { isBitcoinWallet } from "@dynamic-labs/bitcoin";
import { useDynamicContext } from "@dynamic-labs/sdk-react-core";
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { getErrorMessage } from "@/lib/utils";
import { useBtcAddress } from "../queries/use-btc-address";
import { useCanister } from "../use-canister";

export type AcceptOfferStep = "idle" | "signing" | "submitting" | "success" | "error";

export interface AcceptOfferParams {
  offerId: bigint;
  quantitySats: bigint;
}

export function useAcceptOffer() {
  const { primaryWallet } = useDynamicContext();
  const canister = useCanister();
  const address = useBtcAddress("payment");
  const utils = trpc.useUtils();

  const [step, setStep] = useState<AcceptOfferStep>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const mutation = trpc.options.accept.useMutation({
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

  const mutateAsync = async ({ offerId, quantitySats }: AcceptOfferParams) => {
    try {
      if (!canister || !address) {
        throw new Error("Wallet not connected");
      }
      if (!primaryWallet || !isBitcoinWallet(primaryWallet)) {
        throw new Error("Bitcoin wallet not connected");
      }

      setStep("signing");

      const items = [{ offer_id: offerId, quantity: quantitySats }];
      const message = await canister.get_accept_offers_message(address, items);
      const signature = await primaryWallet.signMessage(message, { addressType: "payment" });

      if (!signature) {
        throw new Error("User canceled request");
      }

      setStep("submitting");

      return mutation.mutateAsync({
        address,
        signature,
        items: [{ offerId, quantity: quantitySats }],
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

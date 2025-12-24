"use client";

import { isBitcoinWallet } from "@dynamic-labs/bitcoin";
import { useDynamicContext } from "@dynamic-labs/sdk-react-core";
import { useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { getErrorMessage } from "@/lib/utils";
import { useBtcAddress } from "../queries/use-btc-address";
import { useCanister } from "../use-canister";

export type CancelOfferStep = "idle" | "signing" | "submitting" | "success" | "error";

export function useCancelOffer() {
  const { primaryWallet } = useDynamicContext();
  const canister = useCanister();
  const address = useBtcAddress("payment");
  const utils = trpc.useUtils();

  const [step, setStep] = useState<CancelOfferStep>("idle");

  const mutation = trpc.options.cancel.useMutation({
    onSuccess: () => {
      setStep("success");
      utils.portfolio.get.invalidate();
      utils.options.list.invalidate();
      utils.account.get.invalidate();
    },
    onError: () => {
      setStep("error");
    },
  });

  const mutateAsync = async (offerId: bigint) => {
    if (!canister || !address) {
      throw new Error("Wallet not connected");
    }
    if (!primaryWallet || !isBitcoinWallet(primaryWallet)) {
      throw new Error("Bitcoin wallet not connected");
    }

    let toastId: string | number;

    const cancelPromise = (async () => {
      setStep("signing");
      toastId = toast.loading(`Approve deletion of offer #${offerId}`);

      const message = await canister.get_cancel_offer_message(address, offerId);
      const signature = await primaryWallet.signMessage(message, { addressType: "payment" });

      if (!signature) {
        throw new Error("Failed to sign message");
      }

      setStep("submitting");
      toast.loading(`Deleting offer #${offerId}...`, { id: toastId });

      const result = await mutation.mutateAsync({
        address,
        signature,
        offerId,
      });

      toast.success(`Offer #${offerId} deleted successfully`, { id: toastId });
      return result;
    })();

    cancelPromise.catch((err) => {
      toast.error(getErrorMessage(err, `Failed to cancel offer #${offerId}`), { id: toastId });
    });

    return cancelPromise;
  };

  const reset = () => {
    setStep("idle");
    mutation.reset();
  };

  return {
    ...mutation,
    mutateAsync,
    step,
    reset,
  };
}

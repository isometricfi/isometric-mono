"use client";

import { isBitcoinWallet } from "@dynamic-labs/bitcoin";
import { useDynamicContext } from "@dynamic-labs/sdk-react-core";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { unwrapResult } from "@volumetric/canister-types";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { openOnboardingModal } from "@/components/wallet/OnboardingModal";
import { signBitcoinPaymentMessage } from "@/lib/bitcoin/sign-payment-message";
import { getNiceErrorMessage } from "@/lib/error-message";
import { clearInviteCodeFromSession, readInviteCodeFromSession } from "@/lib/referrals/invite-code";
import { validateInviteCode } from "@/lib/referrals/validate-invite-code";
import { isPauseMode } from "@/lib/site-links";
import { computeExpiresAtSeconds } from "@/lib/use-cases/_shared/wallet-proof";
import type { Output as CreateAccountOutput } from "@/lib/use-cases/account/create-account/schema";
import { trpcClient } from "@/trpc/react";
import { useAccount } from "./queries/use-account";
import { useBtcAddress } from "./queries/use-btc-address";
import { useCanister } from "./use-canister";

export type EnsureAccountStep =
  | "idle"
  | "checking"
  | "awaiting_signature"
  | "creating"
  | "done"
  | "error";

export function useEnsureAccount() {
  const { primaryWallet, handleLogOut } = useDynamicContext();
  const canister = useCanister();
  const address = useBtcAddress("payment");
  const queryClient = useQueryClient();
  const tPause = useTranslations("PauseMode");

  const {
    data: accountData,
    isLoading: isLoadingAccount,
    isFetched: isAccountFetched,
  } = useAccount();

  const attemptedAddressRef = useRef<string | null>(null);
  const [step, setStep] = useState<EnsureAccountStep>("idle");
  const [error, setError] = useState<string | null>(null);

  const shouldCreate = useMemo(() => {
    if (isPauseMode()) return false;
    if (!primaryWallet || !isBitcoinWallet(primaryWallet)) return false;
    if (!canister || !address) return false;
    if (!isAccountFetched || isLoadingAccount) return false;
    if (accountData?.profile) return false;
    if (attemptedAddressRef.current === address) return false;
    return true;
  }, [primaryWallet, canister, address, isAccountFetched, isLoadingAccount, accountData]);

  const createAccountMutation = useMutation<CreateAccountOutput, Error, void>({
    mutationFn: async (): Promise<CreateAccountOutput> => {
      setError(null);

      if (!primaryWallet || !isBitcoinWallet(primaryWallet)) {
        throw new Error("Bitcoin wallet not connected");
      }
      if (!canister || !address) {
        throw new Error("Not ready");
      }

      const inviteCode = readInviteCodeFromSession();
      try {
        await validateInviteCode(canister, inviteCode, address);
      } catch (error) {
        clearInviteCodeFromSession();
        throw error;
      }

      setStep("awaiting_signature");
      const expiresAtSeconds = computeExpiresAtSeconds();
      const message = unwrapResult(
        await canister.get_message_to_sign(
          address,
          inviteCode ? [inviteCode] : [],
          expiresAtSeconds,
        ),
      );
      const signature = await signBitcoinPaymentMessage(primaryWallet, message);

      if (!signature) {
        throw new Error("Signature declined");
      }

      setStep("creating");
      return trpcClient.account.createAccount.mutate({
        address,
        signature,
        expiresAtSeconds: expiresAtSeconds.toString(),
        inviteCode,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: [["account"]] });
      clearInviteCodeFromSession();
      setStep("done");
      openOnboardingModal();
    },
    onError: (err) => {
      setStep("error");
      setError(getNiceErrorMessage(err));
    },
  });

  useEffect(() => {
    if (isLoadingAccount) return;

    if (!primaryWallet || !isBitcoinWallet(primaryWallet) || !address) {
      attemptedAddressRef.current = null;
      setStep("idle");
      setError(null);
      return;
    }

    if (accountData?.profile) {
      attemptedAddressRef.current = null;
      setStep("idle");
      setError(null);
      return;
    }

    if (isPauseMode()) {
      if (attemptedAddressRef.current !== address) {
        attemptedAddressRef.current = address;
        toast.info(tPause("accountCreationBlocked"));
        handleLogOut();
      }
      return;
    }

    if (shouldCreate) {
      attemptedAddressRef.current = address;
      setStep("checking");
      createAccountMutation.mutate();
    }
  }, [
    isLoadingAccount,
    primaryWallet,
    address,
    accountData,
    shouldCreate,
    createAccountMutation,
    handleLogOut,
    tPause,
  ]);

  const isOpen = step !== "idle" && step !== "done";

  const close = () => {
    if (step === "error" || step === "awaiting_signature") {
      handleLogOut();
      setStep("idle");
      setError(null);
    }
  };

  return {
    step,
    error,
    isOpen,
    close,
    isCreating: createAccountMutation.isPending,
  };
}

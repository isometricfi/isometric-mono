"use client";

import { useState } from "react";
import { useDynamicContext } from "@dynamic-labs/sdk-react-core";
import { isBitcoinWallet } from "@dynamic-labs/bitcoin";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useCanister } from "@/hooks/use-canister";
import { useBtcAddress } from "@/hooks/use-btc-address";

export function CreateAccount() {
  const { primaryWallet } = useDynamicContext();
  const canister = useCanister();
  const [error, setError] = useState<string | null>(null);

  const address = useBtcAddress("payment");

  const {
    data: accountInfo,
    isLoading: isLoadingAccount,
    refetch: refetchAccount,
  } = useQuery({
    queryKey: ["account", address],
    queryFn: async () => {
      if (!canister || !address) return null;
      const result = await canister.get_account_info(address);
      return result.length > 0 ? result[0] : null;
    },
    enabled: !!canister && !!address,
  });

  const { data: messageToSign } = useQuery({
    queryKey: ["messageToSign", address],
    queryFn: async () => {
      if (!canister || !address) return null;
      return canister.get_message_to_sign(address);
    },
    enabled: !!canister && !!address && !accountInfo,
  });

  const createAccountMutation = useMutation({
    mutationFn: async () => {
      setError(null);

      if (!primaryWallet || !isBitcoinWallet(primaryWallet)) {
        throw new Error("Bitcoin wallet not connected");
      }

      if (!canister) {
        throw new Error("Canister not available");
      }

      if (!address) {
        throw new Error("No address");
      }

      const message = await canister.get_message_to_sign(address);
      const signature = await primaryWallet.signMessage(message, { addressType: "payment" });

      if (!signature) {
        throw new Error("Failed to sign message");
      }

      const result = await canister.create_account({
        data: {},
        wallet_proof: {
          address,
          signature,
        },
      });

      if ("Err" in result) {
        const err = result.Err;
        if ("InvalidSignature" in err) {
          throw new Error(err.InvalidSignature);
        } else if ("ProfileAlreadyRegistered" in err) {
          throw new Error("Account already exists");
        } else if ("Internal" in err) {
          throw new Error(err.Internal);
        }
        throw new Error("Unknown error");
      }

      return result.Ok;
    },
    onSuccess: () => {
      refetchAccount();
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : "Failed to create account");
    },
  });

  if (!primaryWallet) {
    return (
      <div className="text-zinc-500 text-sm">
        Connect your Bitcoin wallet to create an account
      </div>
    );
  }

  const isSupportedAddress =
    address?.startsWith("bc1q") ||
    address?.startsWith("bc1p") ||
    address?.startsWith("3");

  if (!isSupportedAddress) {
    return (
      <div className="p-4 rounded-lg border border-yellow-500/50 bg-yellow-500/10">
        <span className="text-sm text-yellow-500">
          Unsupported address type. Please use native SegWit (bc1q), Taproot
          (bc1p), or nested SegWit (3...) address.
        </span>
      </div>
    );
  }

  if (isLoadingAccount) {
    return <div className="text-zinc-500 text-sm">Loading account...</div>;
  }

  if (accountInfo) {
    return (
      <div className="flex flex-col gap-4">
        <div className="p-4 rounded-lg border border-green-500/50 bg-green-500/10">
          <span className="text-sm font-medium text-green-500">
            Account Active
          </span>
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-sm text-zinc-500">BTC Address</span>
          <code className="text-xs bg-zinc-800 p-2 rounded break-all">
            {accountInfo.address}
          </code>
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-sm text-zinc-500">Internal Principal</span>
          <code className="text-xs bg-zinc-800 p-2 rounded break-all">
            {accountInfo.principal.toText()}
          </code>
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-sm text-zinc-500">Subaccount (for deposits)</span>
          <code className="text-xs bg-zinc-800 p-2 rounded break-all">
            {Array.from(accountInfo.subaccount as Uint8Array)
              .map((b: number) => b.toString(16).padStart(2, "0"))
              .join("")}
          </code>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <span className="text-sm text-zinc-500">Connected Address</span>
        <code className="text-xs bg-zinc-800 p-2 rounded break-all">
          {address}
        </code>
      </div>

      {messageToSign && (
        <div className="flex flex-col gap-2">
          <span className="text-sm text-zinc-500">Message to Sign</span>
          <code className="text-xs bg-zinc-800 p-2 rounded whitespace-pre-wrap">
            {messageToSign}
          </code>
        </div>
      )}

      <button
        onClick={() => createAccountMutation.mutate()}
        disabled={createAccountMutation.isPending}
        className="px-4 py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {createAccountMutation.isPending ? "Creating Account..." : "Create Account"}
      </button>

      {error && (
        <div className="text-sm text-red-500 p-2 bg-red-950 rounded">
          {error}
        </div>
      )}
    </div>
  );
}

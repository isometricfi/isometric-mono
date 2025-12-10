"use client";

import { useState } from "react";
import { useDynamicContext } from "@dynamic-labs/sdk-react-core";
import { isBitcoinWallet } from "@dynamic-labs/bitcoin";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCanister } from "@/hooks/use-canister";
import { useBtcAddress } from "@/hooks/use-btc-address";

export function UpdateUsername() {
  const { primaryWallet } = useDynamicContext();
  const canister = useCanister();
  const queryClient = useQueryClient();
  const [username, setUsername] = useState("");
  const [error, setError] = useState<string | null>(null);

  const address = useBtcAddress("payment");

  const { data: accountInfo, isLoading: isLoadingAccount } = useQuery({
    queryKey: ["account", address],
    queryFn: async () => {
      if (!canister || !address) return null;
      const result = await canister.get_account_info(address);
      return result.length > 0 ? result[0] : null;
    },
    enabled: !!canister && !!address,
  });

  const { data: messageToSign } = useQuery({
    queryKey: ["usernameMessage", address, username],
    queryFn: async () => {
      if (!canister || !address || !username) return null;
      return canister.get_username_update_message(address, username);
    },
    enabled: !!canister && !!address && !!username,
  });

  const updateUsernameMutation = useMutation({
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

      if (!username.trim()) {
        throw new Error("Username cannot be empty");
      }

      const message = await canister.get_username_update_message(address, username);
      const signature = await primaryWallet.signMessage(message, { addressType: "payment" });

      if (!signature) {
        throw new Error("Failed to sign message");
      }

      const result = await canister.update_username({
        data: { username },
        wallet_proof: {
          address,
          signature,
        },
      });

      if ("Err" in result) {
        const err = result.Err;
        if ("InvalidSignature" in err) {
          throw new Error(err.InvalidSignature);
        } else if ("ProfileNotFound" in err) {
          throw new Error("Profile not found");
        } else if ("Internal" in err) {
          throw new Error(err.Internal);
        }
        throw new Error("Unknown error");
      }

      return result.Ok;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["account", address] });
      queryClient.invalidateQueries({ queryKey: ["users"] });
      setUsername("");
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : "Failed to update username");
    },
  });

  if (!primaryWallet) {
    return (
      <div className="text-zinc-500 text-sm">
        Connect your Bitcoin wallet to update username
      </div>
    );
  }

  if (isLoadingAccount) {
    return <div className="text-zinc-500 text-sm">Loading account...</div>;
  }

  if (!accountInfo) {
    return (
      <div className="text-zinc-500 text-sm">
        Create an account first to set a username
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <span className="text-sm text-zinc-400">Current Username</span>
        <code className="text-sm bg-zinc-800 p-2 rounded">
          {accountInfo.username && accountInfo.username.length > 0
            ? accountInfo.username[0]
            : "Not set"}
        </code>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="username" className="text-sm text-zinc-400">
          New Username
        </label>
        <input
          id="username"
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Enter new username..."
          className="w-full bg-zinc-800 border border-zinc-700 rounded px-4 py-2 text-sm focus:outline-none focus:border-zinc-600"
        />
      </div>

      {messageToSign && (
        <div className="flex flex-col gap-2">
          <span className="text-sm text-zinc-400">Message to Sign</span>
          <code className="text-xs bg-zinc-800 p-2 rounded whitespace-pre-wrap">
            {messageToSign}
          </code>
        </div>
      )}

      <button
        onClick={() => updateUsernameMutation.mutate()}
        disabled={updateUsernameMutation.isPending || !username.trim()}
        className="px-4 py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {updateUsernameMutation.isPending ? "Updating..." : "Update Username"}
      </button>

      {error && (
        <div className="text-sm text-red-500 p-2 bg-red-950 rounded">
          {error}
        </div>
      )}
    </div>
  );
}

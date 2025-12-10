"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useCanister } from "@/hooks/use-canister";
import { useBtcAddress } from "@/hooks/use-btc-address";

export function AccountQueries() {
  const canister = useCanister();
  const [queryAddress, setQueryAddress] = useState("");

  const connectedAddress = useBtcAddress("payment");

  const {
    data: nonce,
    refetch: refetchNonce,
    isLoading: isLoadingNonce,
  } = useQuery({
    queryKey: ["nonce", queryAddress || connectedAddress],
    queryFn: async () => {
      if (!canister) return null;
      const addr = queryAddress || connectedAddress;
      if (!addr) return null;
      return canister.get_account_nonce(addr);
    },
    enabled: !!canister && !!(queryAddress || connectedAddress),
  });

  const {
    data: messageToSign,
    refetch: refetchMessage,
    isLoading: isLoadingMessage,
  } = useQuery({
    queryKey: ["message", queryAddress || connectedAddress],
    queryFn: async () => {
      if (!canister) return null;
      const addr = queryAddress || connectedAddress;
      if (!addr) return null;
      return canister.get_message_to_sign(addr);
    },
    enabled: !!canister && !!(queryAddress || connectedAddress),
  });

  const {
    data: accountInfo,
    refetch: refetchAccountInfo,
    isLoading: isLoadingAccountInfo,
  } = useQuery({
    queryKey: ["accountInfo", queryAddress || connectedAddress],
    queryFn: async () => {
      if (!canister) return null;
      const addr = queryAddress || connectedAddress;
      if (!addr) return null;
      const result = await canister.get_account_info(addr);
      return result.length > 0 ? result[0] : null;
    },
    enabled: !!canister && !!(queryAddress || connectedAddress),
  });

  const handleRefreshAll = () => {
    refetchNonce();
    refetchMessage();
    refetchAccountInfo();
  };

  const activeAddress = queryAddress || connectedAddress;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <label className="text-sm text-zinc-400">
          Query Address (leave empty to use connected wallet)
        </label>
        <input
          type="text"
          value={queryAddress}
          onChange={(e) => setQueryAddress(e.target.value)}
          placeholder={connectedAddress || "Enter BTC address..."}
          className="w-full bg-zinc-800 border border-zinc-700 rounded px-4 py-2 text-sm focus:outline-none focus:border-zinc-600"
        />
      </div>

      <div className="flex gap-2">
        <button
          onClick={handleRefreshAll}
          disabled={!activeAddress}
          className="px-4 py-2 bg-zinc-700 text-white rounded font-medium hover:bg-zinc-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Refresh All
        </button>
      </div>

      {activeAddress && (
        <div className="grid gap-4">
          <div className="bg-zinc-800 rounded-lg p-4">
            <div className="text-sm text-zinc-400 mb-2">get_account_nonce()</div>
            {isLoadingNonce ? (
              <div className="text-zinc-500">Loading...</div>
            ) : (
              <code className="text-lg font-mono text-green-400">
                {nonce?.toString() ?? "N/A"}
              </code>
            )}
          </div>

          <div className="bg-zinc-800 rounded-lg p-4">
            <div className="text-sm text-zinc-400 mb-2">get_message_to_sign()</div>
            {isLoadingMessage ? (
              <div className="text-zinc-500">Loading...</div>
            ) : (
              <code className="text-sm font-mono whitespace-pre-wrap break-all">
                {messageToSign ?? "N/A"}
              </code>
            )}
          </div>

          <div className="bg-zinc-800 rounded-lg p-4">
            <div className="text-sm text-zinc-400 mb-2">get_account_info()</div>
            {isLoadingAccountInfo ? (
              <div className="text-zinc-500">Loading...</div>
            ) : accountInfo ? (
              <div className="space-y-2 text-sm font-mono">
                <div>
                  <span className="text-zinc-500">address: </span>
                  <span className="text-green-400 break-all">{accountInfo.address}</span>
                </div>
                <div>
                  <span className="text-zinc-500">principal: </span>
                  <span className="text-green-400 break-all">{accountInfo.principal.toText()}</span>
                </div>
                <div>
                  <span className="text-zinc-500">subaccount: </span>
                  <span className="text-green-400 break-all">
                    {Array.from(accountInfo.subaccount as Uint8Array)
                      .map((b: number) => b.toString(16).padStart(2, "0"))
                      .join("")}
                  </span>
                </div>
              </div>
            ) : (
              <div className="text-zinc-500">No account found</div>
            )}
          </div>
        </div>
      )}

      {!activeAddress && (
        <div className="text-zinc-500 text-sm">
          Connect a wallet or enter an address to query
        </div>
      )}
    </div>
  );
}

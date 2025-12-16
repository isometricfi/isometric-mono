"use client";

import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import type { SyncBalanceResponse } from "@/app/api/canister/sync-balance/route";
import { useBtcAddress } from "@/hooks/use-btc-address";

export function SyncBalance() {
  const address = useBtcAddress("payment");
  const [customAddress, setCustomAddress] = useState("");

  const syncMutation = useMutation({
    mutationFn: async (addr: string): Promise<SyncBalanceResponse> => {
      const response = await fetch("/api/canister/sync-balance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: addr }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || data.error || "Failed to sync balance");
      }

      return data;
    },
  });

  const targetAddress = customAddress || address || "";

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-zinc-500">
        Sync internal balance with actual ckBTC ledger balance. Controller-only.
      </p>

      <div className="flex flex-col gap-2">
        <label htmlFor="sync-address" className="text-sm text-zinc-500">
          Address (defaults to connected wallet)
        </label>
        <input
          id="sync-address"
          type="text"
          value={customAddress}
          onChange={(e) => setCustomAddress(e.target.value)}
          placeholder={address || "Enter address..."}
          className="w-full bg-zinc-800 border border-zinc-700 rounded px-4 py-2 focus:outline-none focus:border-zinc-600 font-mono text-sm"
        />
      </div>

      <button
        type="button"
        onClick={() => syncMutation.mutate(targetAddress)}
        disabled={syncMutation.isPending || !targetAddress}
        className="px-4 py-2 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {syncMutation.isPending ? "Syncing..." : "Sync Balance from Ledger"}
      </button>

      {syncMutation.isSuccess && (
        <div className="p-3 bg-green-950 border border-green-800 rounded-lg">
          <div className="text-sm text-green-400 mb-1">Balance Synced</div>
          <div className="text-xs text-zinc-300 font-mono">
            Available: {BigInt(syncMutation.data.balance).toLocaleString()} sats
          </div>
        </div>
      )}

      {syncMutation.isError && (
        <div className="p-3 bg-red-950 border border-red-800 rounded-lg">
          <div className="text-sm text-red-400">{syncMutation.error?.message}</div>
        </div>
      )}
    </div>
  );
}

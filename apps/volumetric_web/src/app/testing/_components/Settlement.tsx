"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import type { SetOraclePriceResponse } from "@/app/api/canister/set-oracle-price/route";
import type { TestingForceSettleResponse } from "@/app/api/canister/testing-force-settle/route";
import { useCanister } from "@/hooks/use-canister";

function getOptionStatus(status: Record<string, null>): string {
  if ("Active" in status) return "Active";
  if ("Settling" in status) return "Settling";
  if ("Settled" in status) return "Settled";
  if ("Expired" in status) return "Expired";
  return "Unknown";
}

export function Settlement() {
  const canister = useCanister();
  const [forceSettleOptionId, setForceSettleOptionId] = useState("");
  const [oraclePrice, setOraclePrice] = useState("");

  const {
    data: pendingSettlements,
    isLoading,
    refetch: refetchPending,
  } = useQuery({
    queryKey: ["pendingSettlements"],
    queryFn: async () => {
      if (!canister) return [];
      return canister.get_pending_settlements();
    },
    enabled: !!canister,
    refetchInterval: 10000,
  });

  const setOracleMutation = useMutation({
    mutationFn: async (priceCents: string): Promise<SetOraclePriceResponse> => {
      const response = await fetch("/api/canister/set-oracle-price", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priceCents }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error?.message || data.error || "Failed to set oracle price");
      }
      return data;
    },
  });

  const forceSettleMutation = useMutation({
    mutationFn: async (id: string): Promise<TestingForceSettleResponse> => {
      const response = await fetch("/api/canister/testing-force-settle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ optionId: id }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error?.message || data.error || "Failed to force settle option");
      }
      return data;
    },
    onSuccess: () => {
      refetchPending();
      setForceSettleOptionId("");
    },
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4">
        <h3 className="text-lg font-medium text-zinc-200">Oracle Price</h3>
        <p className="text-sm text-zinc-500">
          Set the oracle price for settlement calculations. Controller-only.
        </p>

        <div className="flex gap-4">
          <input
            type="number"
            value={oraclePrice}
            onChange={(e) => setOraclePrice(e.target.value)}
            placeholder="Price in USD (e.g. 100000 = $100,000)"
            className="flex-1 bg-zinc-800 border border-zinc-700 rounded px-4 py-2 focus:outline-none focus:border-zinc-600"
          />
          <button
            type="button"
            onClick={() => setOracleMutation.mutate((Number(oraclePrice) * 100).toString())}
            disabled={setOracleMutation.isPending || !oraclePrice}
            className="px-4 py-2 bg-yellow-600 text-white rounded-lg font-medium hover:bg-yellow-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {setOracleMutation.isPending ? "Setting..." : "Set Price"}
          </button>
        </div>

        {setOracleMutation.isSuccess && (
          <div className="p-3 bg-green-950 border border-green-800 rounded-lg">
            <div className="text-sm text-green-400">Oracle price updated</div>
          </div>
        )}

        {setOracleMutation.isError && (
          <div className="p-3 bg-red-950 border border-red-800 rounded-lg">
            <div className="text-sm text-red-400">{setOracleMutation.error?.message}</div>
          </div>
        )}
      </div>

      <div className="border-t border-zinc-800" />

      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium text-zinc-200">Pending Settlements</h3>
          <button
            type="button"
            onClick={() => refetchPending()}
            className="text-sm text-zinc-400 hover:text-zinc-200"
          >
            Refresh
          </button>
        </div>

        {isLoading ? (
          <div className="text-zinc-500 text-sm">Loading...</div>
        ) : pendingSettlements && pendingSettlements.length > 0 ? (
          <div className="flex flex-col gap-3">
            {pendingSettlements.map((option) => (
              <div key={option.id.toString()} className="p-4 bg-zinc-800 rounded-lg">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="text-sm font-medium">Option #{option.id.toString()}</div>
                    <div className="text-xs text-zinc-500">
                      Status: {getOptionStatus(option.status)}
                    </div>
                  </div>
                  <div className="text-right text-xs text-zinc-400">
                    <div>Qty: {option.quantity.toLocaleString()} sats</div>
                    <div>Strike: ${(Number(option.strike_price_cents) / 100).toLocaleString()}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-zinc-500 text-sm">No options pending settlement</div>
        )}
      </div>

      <div className="border-t border-zinc-800" />

      <div className="flex flex-col gap-4">
        <h3 className="text-lg font-medium text-zinc-200">Force Settle Option</h3>
        <p className="text-sm text-zinc-500">
          Immediately settle an option regardless of expiry time. Uses current oracle price.
        </p>

        <div className="flex gap-4">
          <input
            type="number"
            value={forceSettleOptionId}
            onChange={(e) => setForceSettleOptionId(e.target.value)}
            placeholder="Option ID"
            className="flex-1 bg-zinc-800 border border-zinc-700 rounded px-4 py-2 focus:outline-none focus:border-zinc-600"
          />
          <button
            type="button"
            onClick={() => forceSettleMutation.mutate(forceSettleOptionId)}
            disabled={forceSettleMutation.isPending || !forceSettleOptionId}
            className="px-4 py-2 bg-orange-600 text-white rounded-lg font-medium hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {forceSettleMutation.isPending ? "Settling..." : "Force Settle"}
          </button>
        </div>

        {forceSettleMutation.isSuccess && (
          <div className="p-3 bg-green-950 border border-green-800 rounded-lg">
            <div className="text-sm text-green-400 mb-2">Option Settled!</div>
            <div className="text-xs text-zinc-300 space-y-1">
              <div>Option ID: {forceSettleMutation.data.optionId}</div>
              <div>
                Settlement Price: $
                {(Number(forceSettleMutation.data.settlementPriceCents) / 100).toLocaleString()}
              </div>
              <div>
                Payout to Buyer: {Number(forceSettleMutation.data.payoutToBuyer).toLocaleString()}{" "}
                sats
              </div>
              <div>
                Payout to Writer: {Number(forceSettleMutation.data.payoutToWriter).toLocaleString()}{" "}
                sats
              </div>
            </div>
          </div>
        )}

        {forceSettleMutation.isError && (
          <div className="p-3 bg-red-950 border border-red-800 rounded-lg">
            <div className="text-sm text-red-400">{forceSettleMutation.error?.message}</div>
          </div>
        )}
      </div>
    </div>
  );
}

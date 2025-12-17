"use client";

import { isBitcoinWallet } from "@dynamic-labs/bitcoin";
import { useDynamicContext } from "@dynamic-labs/sdk-react-core";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { ActiveOption, Offer } from "@volumetric/canister-types";
import { unwrapResult } from "@volumetric/canister-types";
import { useState } from "react";
import type { AcceptOffersResponse } from "@/app/api/canister/accept-offers/route";
import type { CreateOfferResponse } from "@/app/api/canister/create-offer/route";
import { useBtcAddress } from "@/hooks/use-btc-address";
import { useCanister } from "@/hooks/use-canister";

const ONE_DAY_NS = BigInt(86400) * BigInt(1_000_000_000);

function formatSats(sats: bigint): string {
  return `${sats.toLocaleString()} sats`;
}

function formatTimestamp(ns: bigint): string {
  const ms = Number(ns / BigInt(1_000_000));
  return new Date(ms).toLocaleString();
}

function getOfferStatus(offer: Offer): string {
  if ("Open" in offer.status) return "Open";
  if ("PartiallyFilled" in offer.status) return "Partially Filled";
  if ("Filled" in offer.status) return "Filled";
  if ("Cancelled" in offer.status) return "Cancelled";
  if ("Processing" in offer.status) return "Processing";
  return "Unknown";
}

function getOptionStatus(option: ActiveOption): string {
  if ("Active" in option.status) return "Active";
  if ("Settling" in option.status) return "Settling";
  if ("Settled" in option.status) return "Settled";
  if ("Expired" in option.status) return "Expired";
  return "Unknown";
}

export function OptionsTrading() {
  const { primaryWallet } = useDynamicContext();
  const canister = useCanister();
  const address = useBtcAddress("payment");

  const [quantity, setQuantity] = useState("100000");
  const [strikeBasisPoints, setStrikeBasisPoints] = useState("500");
  const [premiumBasisPoints, setPremiumBasisPoints] = useState("500");
  const [acceptOfferId, setAcceptOfferId] = useState("");
  const [acceptQuantity, setAcceptQuantity] = useState("");

  const { data: accountInfo, isLoading: isLoadingAccount } = useQuery({
    queryKey: ["account", address],
    queryFn: async () => {
      if (!canister || !address) return null;
      const result = await canister.get_account_info(address);
      return result.length > 0 ? result[0] : null;
    },
    enabled: !!canister && !!address,
  });

  const {
    data: openOffers,
    isLoading: isLoadingOffers,
    refetch: refetchOffers,
  } = useQuery({
    queryKey: ["openOffers"],
    queryFn: async () => {
      if (!canister) return [];
      return canister.get_open_offers();
    },
    enabled: !!canister,
    refetchInterval: 10000,
  });

  const {
    data: myOffers,
    isLoading: isLoadingMyOffers,
    refetch: refetchMyOffers,
  } = useQuery({
    queryKey: ["myOffers", address],
    queryFn: async () => {
      if (!canister || !address) return [];
      const result = await canister.get_my_offers(address);
      return unwrapResult(result);
    },
    enabled: !!canister && !!address && !!accountInfo,
  });

  const {
    data: myOptions,
    isLoading: isLoadingMyOptions,
    refetch: refetchMyOptions,
  } = useQuery({
    queryKey: ["myOptions", address],
    queryFn: async () => {
      if (!canister || !address) return [];
      const result = await canister.get_my_options(address);
      return unwrapResult(result);
    },
    enabled: !!canister && !!address && !!accountInfo,
  });

  const { data: myWrittenOptions, refetch: refetchMyWrittenOptions } = useQuery({
    queryKey: ["myWrittenOptions", address],
    queryFn: async () => {
      if (!canister || !address) return [];
      const result = await canister.get_my_written_options(address);
      return unwrapResult(result);
    },
    enabled: !!canister && !!address && !!accountInfo,
  });

  const createOfferMutation = useMutation({
    mutationFn: async (): Promise<CreateOfferResponse> => {
      if (!canister || !address) throw new Error("Not ready");
      if (!primaryWallet || !isBitcoinWallet(primaryWallet)) {
        throw new Error("Bitcoin wallet not connected");
      }

      const qty = BigInt(quantity);
      const strike = Number(strikeBasisPoints);
      const premium = Number(premiumBasisPoints);

      const message = await canister.get_create_offer_message(address, qty, strike, premium);
      const signature = await primaryWallet.signMessage(message, { addressType: "payment" });

      if (!signature) throw new Error("Failed to sign message");

      const now = BigInt(Date.now()) * BigInt(1_000_000);
      const offerValidUntil = now + ONE_DAY_NS;
      const optionDurationSeconds = BigInt(3600);

      const response = await fetch("/api/canister/create-offer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address,
          signature,
          quantity: qty.toString(),
          strikeBasisPoints: strike,
          premiumBasisPoints: premium,
          offerValidUntil: offerValidUntil.toString(),
          optionDurationSeconds: optionDurationSeconds.toString(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || data.error || "Failed to create offer");
      }

      return data;
    },
    onSuccess: () => {
      refetchOffers();
      refetchMyOffers();
    },
  });

  const cancelOfferMutation = useMutation({
    mutationFn: async (offerId: bigint) => {
      if (!canister || !address) throw new Error("Not ready");
      if (!primaryWallet || !isBitcoinWallet(primaryWallet)) {
        throw new Error("Bitcoin wallet not connected");
      }

      const message = await canister.get_cancel_offer_message(address, offerId);
      const signature = await primaryWallet.signMessage(message, { addressType: "payment" });

      if (!signature) throw new Error("Failed to sign message");

      const result = await canister.cancel_offer({
        wallet_proof: { address, signature },
        data: { offer_id: offerId },
      });

      return unwrapResult(result);
    },
    onSuccess: () => {
      refetchOffers();
      refetchMyOffers();
    },
  });

  const acceptOfferMutation = useMutation({
    mutationFn: async (): Promise<AcceptOffersResponse> => {
      if (!canister || !address) throw new Error("Not ready");
      if (!primaryWallet || !isBitcoinWallet(primaryWallet)) {
        throw new Error("Bitcoin wallet not connected");
      }

      const items = [{ offer_id: BigInt(acceptOfferId), quantity: BigInt(acceptQuantity) }];

      const message = await canister.get_accept_offers_message(address, items);
      const signature = await primaryWallet.signMessage(message, { addressType: "payment" });

      if (!signature) throw new Error("Failed to sign message");

      const response = await fetch("/api/canister/accept-offers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address,
          signature,
          items: [{ offerId: acceptOfferId, quantity: acceptQuantity }],
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || data.error || "Failed to accept offer");
      }

      return data;
    },
    onSuccess: () => {
      refetchOffers();
      refetchMyOffers();
      refetchMyOptions();
      refetchMyWrittenOptions();
      setAcceptOfferId("");
      setAcceptQuantity("");
    },
  });

  if (!primaryWallet) {
    return <div className="text-zinc-500 text-sm">Connect your Bitcoin wallet first</div>;
  }

  if (isLoadingAccount) {
    return <div className="text-zinc-500 text-sm">Loading account...</div>;
  }

  if (!accountInfo) {
    return (
      <div className="text-zinc-500 text-sm">Create an account first to access options trading</div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4">
        <h3 className="text-lg font-medium text-zinc-200">Create Offer (Write Option)</h3>
        <p className="text-sm text-zinc-500">
          Create a covered call offer. Collateral will be locked from your balance.
        </p>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-2">
            <label htmlFor="quantity" className="text-sm text-zinc-500">
              Quantity (sats)
            </label>
            <input
              id="quantity"
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="100000"
              className="w-full bg-zinc-800 border border-zinc-700 rounded px-4 py-2 focus:outline-none focus:border-zinc-600"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="strike" className="text-sm text-zinc-500">
              Strike (basis points, e.g. 500 = 5% above entry)
            </label>
            <input
              id="strike"
              type="number"
              value={strikeBasisPoints}
              onChange={(e) => setStrikeBasisPoints(e.target.value)}
              placeholder="500"
              className="w-full bg-zinc-800 border border-zinc-700 rounded px-4 py-2 focus:outline-none focus:border-zinc-600"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="premium" className="text-sm text-zinc-500">
              Premium (basis points, e.g. 500 = 5%)
            </label>
            <input
              id="premium"
              type="number"
              value={premiumBasisPoints}
              onChange={(e) => setPremiumBasisPoints(e.target.value)}
              placeholder="500"
              className="w-full bg-zinc-800 border border-zinc-700 rounded px-4 py-2 focus:outline-none focus:border-zinc-600"
            />
          </div>
        </div>

        <button
          type="button"
          onClick={() => createOfferMutation.mutate()}
          disabled={createOfferMutation.isPending}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {createOfferMutation.isPending ? "Creating..." : "Create Offer"}
        </button>

        {createOfferMutation.isSuccess && (
          <div className="p-3 bg-green-950 border border-green-800 rounded-lg">
            <div className="text-sm text-green-400">
              Offer created! ID: {createOfferMutation.data.offerId}
            </div>
          </div>
        )}

        {createOfferMutation.isError && (
          <div className="p-3 bg-red-950 border border-red-800 rounded-lg">
            <div className="text-sm text-red-400">{createOfferMutation.error?.message}</div>
          </div>
        )}
      </div>

      <div className="border-t border-zinc-800" />

      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium text-zinc-200">Open Offers</h3>
          <button
            type="button"
            onClick={() => refetchOffers()}
            className="text-sm text-zinc-400 hover:text-zinc-200"
          >
            Refresh
          </button>
        </div>

        {isLoadingOffers ? (
          <div className="text-zinc-500 text-sm">Loading offers...</div>
        ) : openOffers && openOffers.length > 0 ? (
          <div className="flex flex-col gap-3">
            {openOffers.map((offer) => (
              <div
                key={offer.id.toString()}
                className="p-4 bg-zinc-800 rounded-lg flex flex-col gap-2"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <div className="text-sm font-medium">Offer #{offer.id.toString()}</div>
                    <div className="text-xs text-zinc-500">Status: {getOfferStatus(offer)}</div>
                  </div>
                  <div className="text-right text-sm">
                    <div>{formatSats(offer.remaining_quantity)} available</div>
                    <div className="text-zinc-500">of {formatSats(offer.total_quantity)}</div>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs text-zinc-400">
                  <div>Strike: +{offer.strike_basis_points / 100}%</div>
                  <div>Premium: {offer.premium_basis_points / 100}%</div>
                  <div>Duration: {Number(offer.option_duration_seconds)}s</div>
                </div>
                <div className="text-xs text-zinc-500 truncate">
                  Writer: {offer.writer.toString()}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-zinc-500 text-sm">No open offers</div>
        )}
      </div>

      <div className="border-t border-zinc-800" />

      <div className="flex flex-col gap-4">
        <h3 className="text-lg font-medium text-zinc-200">Accept Offer (Buy Option)</h3>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-2">
            <label htmlFor="accept-offer-id" className="text-sm text-zinc-500">
              Offer ID
            </label>
            <input
              id="accept-offer-id"
              type="number"
              value={acceptOfferId}
              onChange={(e) => setAcceptOfferId(e.target.value)}
              placeholder="1"
              className="w-full bg-zinc-800 border border-zinc-700 rounded px-4 py-2 focus:outline-none focus:border-zinc-600"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="accept-quantity" className="text-sm text-zinc-500">
              Quantity (sats)
            </label>
            <input
              id="accept-quantity"
              type="number"
              value={acceptQuantity}
              onChange={(e) => setAcceptQuantity(e.target.value)}
              placeholder="50000"
              className="w-full bg-zinc-800 border border-zinc-700 rounded px-4 py-2 focus:outline-none focus:border-zinc-600"
            />
          </div>
        </div>

        <button
          type="button"
          onClick={() => acceptOfferMutation.mutate()}
          disabled={acceptOfferMutation.isPending || !acceptOfferId || !acceptQuantity}
          className="px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {acceptOfferMutation.isPending ? "Accepting..." : "Accept Offer"}
        </button>

        {acceptOfferMutation.isSuccess && (
          <div className="p-3 bg-green-950 border border-green-800 rounded-lg">
            <div className="text-sm text-green-400">
              Option created! Fill Group: {acceptOfferMutation.data.fillGroupId}
            </div>
          </div>
        )}

        {acceptOfferMutation.isError && (
          <div className="p-3 bg-red-950 border border-red-800 rounded-lg">
            <div className="text-sm text-red-400">{acceptOfferMutation.error?.message}</div>
          </div>
        )}
      </div>

      <div className="border-t border-zinc-800" />

      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium text-zinc-200">My Offers</h3>
          <button
            type="button"
            onClick={() => refetchMyOffers()}
            className="text-sm text-zinc-400 hover:text-zinc-200"
          >
            Refresh
          </button>
        </div>

        {isLoadingMyOffers ? (
          <div className="text-zinc-500 text-sm">Loading...</div>
        ) : myOffers && myOffers.length > 0 ? (
          <div className="flex flex-col gap-3">
            {myOffers.map((offer) => (
              <div
                key={offer.id.toString()}
                className="p-4 bg-zinc-800 rounded-lg flex justify-between items-center"
              >
                <div>
                  <div className="text-sm font-medium">Offer #{offer.id.toString()}</div>
                  <div className="text-xs text-zinc-500">
                    {getOfferStatus(offer)} | {formatSats(offer.remaining_quantity)} remaining
                  </div>
                </div>
                {("Open" in offer.status || "PartiallyFilled" in offer.status) && (
                  <button
                    type="button"
                    onClick={() => cancelOfferMutation.mutate(offer.id)}
                    disabled={cancelOfferMutation.isPending}
                    className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-zinc-500 text-sm">No offers created</div>
        )}
      </div>

      <div className="border-t border-zinc-800" />

      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium text-zinc-200">My Options (as Buyer)</h3>
          <button
            type="button"
            onClick={() => refetchMyOptions()}
            className="text-sm text-zinc-400 hover:text-zinc-200"
          >
            Refresh
          </button>
        </div>

        {isLoadingMyOptions ? (
          <div className="text-zinc-500 text-sm">Loading...</div>
        ) : myOptions && myOptions.length > 0 ? (
          <div className="flex flex-col gap-3">
            {myOptions.map((option) => (
              <div key={option.id.toString()} className="p-4 bg-zinc-800 rounded-lg">
                <div className="flex justify-between items-start mb-2">
                  <div className="text-sm font-medium">Option #{option.id.toString()}</div>
                  <div className="text-xs px-2 py-1 rounded bg-zinc-700">
                    {getOptionStatus(option)}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs text-zinc-400">
                  <div>Quantity: {formatSats(option.quantity)}</div>
                  <div>Entry: ${(Number(option.entry_price_cents) / 100).toLocaleString()}</div>
                  <div>Strike: ${(Number(option.strike_price_cents) / 100).toLocaleString()}</div>
                  <div>Premium Paid: {formatSats(option.premium_paid)}</div>
                  <div>Expiry: {formatTimestamp(option.expiry)}</div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-zinc-500 text-sm">No options purchased</div>
        )}
      </div>

      <div className="border-t border-zinc-800" />

      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium text-zinc-200">My Written Options (as Writer)</h3>
          <button
            type="button"
            onClick={() => refetchMyWrittenOptions()}
            className="text-sm text-zinc-400 hover:text-zinc-200"
          >
            Refresh
          </button>
        </div>

        {myWrittenOptions && myWrittenOptions.length > 0 ? (
          <div className="flex flex-col gap-3">
            {myWrittenOptions.map((option) => (
              <div key={option.id.toString()} className="p-4 bg-zinc-800 rounded-lg">
                <div className="flex justify-between items-start mb-2">
                  <div className="text-sm font-medium">Option #{option.id.toString()}</div>
                  <div className="text-xs px-2 py-1 rounded bg-zinc-700">
                    {getOptionStatus(option)}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs text-zinc-400">
                  <div>Quantity: {formatSats(option.quantity)}</div>
                  <div>Entry: ${(Number(option.entry_price_cents) / 100).toLocaleString()}</div>
                  <div>Strike: ${(Number(option.strike_price_cents) / 100).toLocaleString()}</div>
                  <div>Premium Received: {formatSats(option.premium_paid)}</div>
                  <div>Expiry: {formatTimestamp(option.expiry)}</div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-zinc-500 text-sm">No options written</div>
        )}
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import {
  type PortfolioOffer,
  useAcceptOffer,
  useAccount,
  useCancelOffer,
  useCreateOffer,
  useOptions,
  usePortfolio,
} from "@/hooks";

function formatSats(sats: bigint | number): string {
  return `${Number(sats).toLocaleString()} sats`;
}

function formatTimestamp(seconds: bigint): string {
  return new Date(Number(seconds) * 1_000).toLocaleString();
}

export function OptionsTrading() {
  const { data: accountData, isLoading: isLoadingAccount } = useAccount();
  const { data: portfolio, refetch: refetchPortfolio } = usePortfolio();
  const { data: optionsData, isLoading: isLoadingOffers, refetch: refetchOffers } = useOptions();

  const createOfferMutation = useCreateOffer();
  const cancelOfferMutation = useCancelOffer();
  const acceptOfferMutation = useAcceptOffer();

  const [quantity, setQuantity] = useState("100000");
  const [strikeBasisPoints, setStrikeBasisPoints] = useState("500");
  const [premiumBasisPoints, setPremiumBasisPoints] = useState("500");
  const [acceptOfferId, setAcceptOfferId] = useState("");
  const [acceptQuantity, setAcceptQuantity] = useState("");

  // Flatten all offers from the grouped options data
  const openOffers =
    optionsData?.termGroups.flatMap((term) => term.strikes.flatMap((strike) => strike.offers)) ??
    [];

  const myOffers = portfolio?.offers ?? [];
  const myOptions = portfolio?.boughtOptions ?? [];
  const myWrittenOptions = portfolio?.writtenOptions ?? [];

  const handleCreateOffer = () => {
    createOfferMutation.mutate(
      {
        quantitySats: Number(quantity),
        strikePercent: Number(strikeBasisPoints) / 100,
        premiumPercent: Number(premiumBasisPoints) / 100,
        termDays: 1, // 1 hour in original was BigInt(3600) seconds
      },
      {
        onSuccess: () => {
          refetchOffers();
          refetchPortfolio();
        },
      },
    );
  };

  const handleCancelOffer = (offerId: string) => {
    cancelOfferMutation.mutate(offerId, {
      onSuccess: () => {
        refetchOffers();
        refetchPortfolio();
      },
    });
  };

  const handleAcceptOffer = () => {
    acceptOfferMutation.mutate(
      {
        offerId: acceptOfferId,
        quantitySats: Number(acceptQuantity),
      },
      {
        onSuccess: () => {
          refetchOffers();
          refetchPortfolio();
          setAcceptOfferId("");
          setAcceptQuantity("");
        },
      },
    );
  };

  const canCancelOffer = (offer: PortfolioOffer): boolean => {
    return offer.status === "Open" || offer.status === "PartiallyFilled";
  };

  if (isLoadingAccount) {
    return <div className="text-zinc-500 text-sm">Loading account...</div>;
  }

  if (!accountData?.profile) {
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
          onClick={handleCreateOffer}
          disabled={createOfferMutation.isPending}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {createOfferMutation.isPending ? "Creating..." : "Create Offer"}
        </button>

        {createOfferMutation.isSuccess && (
          <div className="p-3 bg-green-950 border border-green-800 rounded-lg">
            <div className="text-sm text-green-400">Offer created!</div>
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
        ) : openOffers.length > 0 ? (
          <div className="flex flex-col gap-3">
            {openOffers.map((offer) => (
              <div key={offer.id} className="p-4 bg-zinc-800 rounded-lg flex flex-col gap-2">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="text-sm font-medium">Offer #{offer.id}</div>
                    <div className="text-xs text-zinc-500">Term: {offer.termDays} days</div>
                  </div>
                  <div className="text-right text-sm">
                    <div>{formatSats(offer.amountSats)} available</div>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs text-zinc-400">
                  <div>Strike: +{offer.strikePercent}%</div>
                  <div>Premium: {offer.premium}%</div>
                  <div>Created: {new Date(offer.createdAt).toLocaleDateString()}</div>
                </div>
                <div className="text-xs text-zinc-500 truncate">Writer: {offer.writerId}</div>
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
          onClick={handleAcceptOffer}
          disabled={acceptOfferMutation.isPending || !acceptOfferId || !acceptQuantity}
          className="px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {acceptOfferMutation.isPending ? "Accepting..." : "Accept Offer"}
        </button>

        {acceptOfferMutation.isSuccess && (
          <div className="p-3 bg-green-950 border border-green-800 rounded-lg">
            <div className="text-sm text-green-400">Option created!</div>
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
            onClick={() => refetchPortfolio()}
            className="text-sm text-zinc-400 hover:text-zinc-200"
          >
            Refresh
          </button>
        </div>

        {myOffers.length > 0 ? (
          <div className="flex flex-col gap-3">
            {myOffers.map((offer) => (
              <div
                key={offer.id}
                className="p-4 bg-zinc-800 rounded-lg flex justify-between items-center"
              >
                <div>
                  <div className="text-sm font-medium">Offer #{offer.id}</div>
                  <div className="text-xs text-zinc-500">
                    {offer.status} | {formatSats(offer.remainingQuantity)} remaining
                  </div>
                </div>
                {canCancelOffer(offer) && (
                  <button
                    type="button"
                    onClick={() => handleCancelOffer(offer.id)}
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
            onClick={() => refetchPortfolio()}
            className="text-sm text-zinc-400 hover:text-zinc-200"
          >
            Refresh
          </button>
        </div>

        {myOptions.length > 0 ? (
          <div className="flex flex-col gap-3">
            {myOptions.map((option) => (
              <div key={option.id} className="p-4 bg-zinc-800 rounded-lg">
                <div className="flex justify-between items-start mb-2">
                  <div className="text-sm font-medium">Option #{option.id}</div>
                  <div className="text-xs px-2 py-1 rounded bg-zinc-700">{option.status}</div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs text-zinc-400">
                  <div>Quantity: {formatSats(option.quantity)}</div>
                  <div>Entry: ${(Number(option.entryPriceCents) / 100).toLocaleString()}</div>
                  <div>Strike: ${(Number(option.strikePriceCents) / 100).toLocaleString()}</div>
                  <div>Premium Paid: {formatSats(option.premiumPaid)}</div>
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
            onClick={() => refetchPortfolio()}
            className="text-sm text-zinc-400 hover:text-zinc-200"
          >
            Refresh
          </button>
        </div>

        {myWrittenOptions.length > 0 ? (
          <div className="flex flex-col gap-3">
            {myWrittenOptions.map((option) => (
              <div key={option.id} className="p-4 bg-zinc-800 rounded-lg">
                <div className="flex justify-between items-start mb-2">
                  <div className="text-sm font-medium">Option #{option.id}</div>
                  <div className="text-xs px-2 py-1 rounded bg-zinc-700">{option.status}</div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs text-zinc-400">
                  <div>Quantity: {formatSats(option.quantity)}</div>
                  <div>Entry: ${(Number(option.entryPriceCents) / 100).toLocaleString()}</div>
                  <div>Strike: ${(Number(option.strikePriceCents) / 100).toLocaleString()}</div>
                  <div>Premium Received: {formatSats(option.premiumPaid)}</div>
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

"use client";

import { useQuery } from "@tanstack/react-query";
import type { OfferData, OptionData, PortfolioResponse } from "@/app/api/portfolio/route";
import { QueryKey } from "@/lib/query-keys";
import { useBtcAddress } from "./use-btc-address";

export type PortfolioOffer = {
  id: bigint;
  status: OfferData["status"];
  totalQuantity: bigint;
  remainingQuantity: bigint;
  strikeBasisPoints: number;
  premiumBasisPoints: number;
  optionDurationSeconds: bigint;
  offerValidUntil: bigint;
  createdAt: bigint;
};

export type PortfolioOption = {
  id: bigint;
  status: OptionData["status"];
  quantity: bigint;
  entryPriceCents: bigint;
  strikePriceCents: bigint;
  premiumPaid: bigint;
  expiry: bigint;
  acceptedAt: bigint;
  offerId: bigint;
};

export type PortfolioData = {
  offers: PortfolioOffer[];
  boughtOptions: PortfolioOption[];
  writtenOptions: PortfolioOption[];
};

function parseOffer(offer: OfferData): PortfolioOffer {
  return {
    id: BigInt(offer.id),
    status: offer.status,
    totalQuantity: BigInt(offer.totalQuantity),
    remainingQuantity: BigInt(offer.remainingQuantity),
    strikeBasisPoints: offer.strikeBasisPoints,
    premiumBasisPoints: offer.premiumBasisPoints,
    optionDurationSeconds: BigInt(offer.optionDurationSeconds),
    offerValidUntil: BigInt(offer.offerValidUntil),
    createdAt: BigInt(offer.createdAt),
  };
}

function parseOption(option: OptionData): PortfolioOption {
  return {
    id: BigInt(option.id),
    status: option.status,
    quantity: BigInt(option.quantity),
    entryPriceCents: BigInt(option.entryPriceCents),
    strikePriceCents: BigInt(option.strikePriceCents),
    premiumPaid: BigInt(option.premiumPaid),
    expiry: BigInt(option.expiry),
    acceptedAt: BigInt(option.acceptedAt),
    offerId: BigInt(option.offerId),
  };
}

export function usePortfolio() {
  const address = useBtcAddress("payment");

  return useQuery({
    queryKey: [QueryKey.Portfolio, address],
    queryFn: async (): Promise<PortfolioData | null> => {
      if (!address) return null;

      const response = await fetch("/api/portfolio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address }),
      });

      if (!response.ok) {
        throw new Error("Failed to fetch portfolio data");
      }

      const data: PortfolioResponse = await response.json();

      return {
        offers: data.offers.map(parseOffer),
        boughtOptions: data.boughtOptions.map(parseOption),
        writtenOptions: data.writtenOptions.map(parseOption),
      };
    },
    enabled: !!address,
    refetchInterval: 30000,
  });
}

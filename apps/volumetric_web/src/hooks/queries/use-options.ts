"use client";

import { useQuery } from "@tanstack/react-query";
import { DEFAULT_MIN_ACCEPT_OFFER_AMOUNT_SATS } from "@/lib/utils";
import { useTRPC } from "@/trpc/react";
import type { OptionOffer, OptionsData } from "@/types/options";
import { useConfig } from "./use-config";

export function useOptions() {
  const trpc = useTRPC();
  const { data: config } = useConfig();
  const minAcceptOfferAmountSats =
    config?.minAcceptOfferAmountSats ?? DEFAULT_MIN_ACCEPT_OFFER_AMOUNT_SATS;

  return useQuery({
    ...trpc.options.listOptions.queryOptions(),
    staleTime: 30000,
    select: (data) => {
      const filteredTermGroups = data.termGroups
        .map((termGroup) => {
          const filteredStrikes = termGroup.strikes
            .map((strike) => ({
              ...strike,
              offers: strike.offers.filter((offer) => offer.amountSats >= minAcceptOfferAmountSats),
            }))
            .filter((strike) => strike.offers.length > 0);

          return {
            ...termGroup,
            strikes: filteredStrikes,
          };
        })
        .filter((termGroup) => termGroup.strikes.length > 0);

      return {
        ...data,
        termGroups: filteredTermGroups,
      };
    },
  });
}

export function findBestOffer(
  data: OptionsData | undefined,
  term: number,
  strikePercent: number,
  amountSats: number,
): OptionOffer | null {
  if (!data || amountSats <= 0) return null;

  const termGroup = data.termGroups.find((g) => g.term === term);
  if (!termGroup) return null;

  const strikeBucket = termGroup.strikes.find((s) => s.strikePercent === strikePercent);
  if (!strikeBucket) return null;

  const sortedOffers = [...strikeBucket.offers].sort((a, b) => {
    if (a.premium !== b.premium) return a.premium - b.premium;
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });

  return sortedOffers.find((offer) => offer.amountSats >= amountSats) ?? null;
}

export function getMaxLiquiditySats(
  data: OptionsData | undefined,
  term: number,
  strikePercent: number,
): number {
  if (!data) return 0;

  const termGroup = data.termGroups.find((g) => g.term === term);
  if (!termGroup) return 0;

  const strikeBucket = termGroup.strikes.find((s) => s.strikePercent === strikePercent);
  if (!strikeBucket || strikeBucket.offers.length === 0) return 0;

  return Math.max(...strikeBucket.offers.map((o) => o.amountSats));
}

export function getStrikePercentsForTerm(data: OptionsData | undefined, term: number): number[] {
  if (!data) return [];

  const termGroup = data.termGroups.find((g) => g.term === term);
  if (!termGroup) return [];

  return termGroup.strikes.map((s) => s.strikePercent);
}

export function getOfferRank(
  data: OptionsData | undefined,
  offerId: string,
  term: number,
  strikePercent: number,
): { rank: number; totalOffers: number; isBest: boolean; isLargestAtPremium: boolean } | null {
  if (!data) return null;

  const termGroup = data.termGroups.find((g) => g.term === term);
  if (!termGroup) return null;

  const strikeBucket = termGroup.strikes.find((s) => s.strikePercent === strikePercent);
  if (!strikeBucket) return null;

  // Match the buyer-side matcher (premium-amount.ts): premium asc, then FIFO.
  const sortedOffers = [...strikeBucket.offers].sort((a, b) => {
    if (a.premium !== b.premium) return a.premium - b.premium;
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });

  const index = sortedOffers.findIndex((o) => o.id === offerId);
  if (index === -1) return null;

  const offer = sortedOffers[index];
  const peersAtSamePremium = sortedOffers.filter(
    (other) => other.id !== offer.id && other.premium === offer.premium,
  );
  const isLargestAtPremium =
    peersAtSamePremium.length > 0 &&
    peersAtSamePremium.every((other) => other.amountSats < offer.amountSats);

  return {
    rank: index + 1,
    totalOffers: sortedOffers.length,
    isBest: index === 0,
    isLargestAtPremium,
  };
}

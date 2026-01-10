"use client";

import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/react";
import type { OptionOffer, OptionsData } from "@/types/options";
import { useConfig } from "./use-config";

export function useOptions() {
  const trpc = useTRPC();
  const { data: config } = useConfig();
  const minOfferAmountSats = config?.minOfferAmountSats ?? 90_000;

  return useQuery({
    ...trpc.options.listOptions.queryOptions(),
    staleTime: 30000,
    select: (data) => {
      const filteredTermGroups = data.termGroups
        .map((termGroup) => {
          const filteredStrikes = termGroup.strikes
            .map((strike) => ({
              ...strike,
              offers: strike.offers.filter((offer) => offer.amountSats >= minOfferAmountSats),
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
): { rank: number; totalOffers: number; isBest: boolean } | null {
  if (!data) return null;

  const termGroup = data.termGroups.find((g) => g.term === term);
  if (!termGroup) return null;

  const strikeBucket = termGroup.strikes.find((s) => s.strikePercent === strikePercent);
  if (!strikeBucket) return null;

  // Sorting logic:
  // 1. Lowest premium (asc)
  // 2. Size of offer (desc) - assuming larger is better/more liquid
  // 3. Date created (asc) - FIFO
  const sortedOffers = [...strikeBucket.offers].sort((a, b) => {
    // 1. Premium
    if (a.premium !== b.premium) return a.premium - b.premium;

    // 2. Size (desc)
    if (a.amountSats !== b.amountSats) return b.amountSats - a.amountSats;

    // 3. Created At (asc)
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });

  const index = sortedOffers.findIndex((o) => o.id === offerId);
  if (index === -1) return null;

  return {
    rank: index + 1,
    totalOffers: sortedOffers.length,
    isBest: index === 0,
  };
}

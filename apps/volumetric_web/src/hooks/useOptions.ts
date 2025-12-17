"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchOptions } from "@/lib/fetchers";
import { QueryKey } from "@/lib/query-keys";
import type { OptionOffer, OptionsData } from "@/types/options";

export function useOptions() {
  return useQuery({
    queryKey: [QueryKey.Options],
    queryFn: fetchOptions,
    staleTime: 30000,
  });
}

export function findBestOffer(
  data: OptionsData | undefined,
  term: number,
  strikePercent: number,
  amountSats: number,
): OptionOffer | null {
  if (!data) return null;

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

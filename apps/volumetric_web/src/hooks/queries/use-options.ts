"use client";

import type { Offer } from "@volumetric/canister-types";
import { groupOffersByTermAndStrike } from "@/lib/options-transformer";
import { trpc } from "@/lib/trpc";
import type { OptionsData } from "@/types/options";

export function useOptions() {
  const query = trpc.options.list.useQuery(undefined, {
    staleTime: 30000,
  });

  const data: OptionsData | undefined = query.data
    ? groupOffersByTermAndStrike(query.data)
    : undefined;

  return {
    ...query,
    data,
  };
}

export function findBestOffer(
  data: OptionsData | undefined,
  term: number,
  strikePercent: number,
  amountSats: bigint,
): Offer | null {
  if (!data || amountSats <= BigInt(0)) return null;

  const termGroup = data.termGroups.find((g) => g.term === term);
  if (!termGroup) return null;

  const strikeBucket = termGroup.strikes.find((s) => s.strikePercent === strikePercent);
  if (!strikeBucket) return null;

  const sortedOffers = [...strikeBucket.offers].sort((a, b) => {
    if (a.premium_basis_points !== b.premium_basis_points) {
      return a.premium_basis_points - b.premium_basis_points;
    }
    return Number(a.created_at - b.created_at);
  });

  return sortedOffers.find((offer) => offer.remaining_quantity >= amountSats) ?? null;
}

export function getMaxLiquiditySats(
  data: OptionsData | undefined,
  term: number,
  strikePercent: number,
): bigint {
  if (!data) return BigInt(0);

  const termGroup = data.termGroups.find((g) => g.term === term);
  if (!termGroup) return BigInt(0);

  const strikeBucket = termGroup.strikes.find((s) => s.strikePercent === strikePercent);
  if (!strikeBucket || strikeBucket.offers.length === 0) return BigInt(0);

  return strikeBucket.offers.reduce(
    (max, o) => (o.remaining_quantity > max ? o.remaining_quantity : max),
    BigInt(0),
  );
}

export function getStrikePercentsForTerm(data: OptionsData | undefined, term: number): number[] {
  if (!data) return [];

  const termGroup = data.termGroups.find((g) => g.term === term);
  if (!termGroup) return [];

  return termGroup.strikes.map((s) => s.strikePercent);
}

export function getOfferRank(
  data: OptionsData | undefined,
  offerId: bigint,
  term: number,
  strikePercent: number,
): { rank: number; totalOffers: number; isBest: boolean } | null {
  if (!data) return null;

  const termGroup = data.termGroups.find((g) => g.term === term);
  if (!termGroup) return null;

  const strikeBucket = termGroup.strikes.find((s) => s.strikePercent === strikePercent);
  if (!strikeBucket) return null;

  const sortedOffers = [...strikeBucket.offers].sort((a, b) => {
    if (a.premium_basis_points !== b.premium_basis_points) {
      return a.premium_basis_points - b.premium_basis_points;
    }
    if (a.remaining_quantity !== b.remaining_quantity) {
      return Number(b.remaining_quantity - a.remaining_quantity);
    }
    return Number(a.created_at - b.created_at);
  });

  const index = sortedOffers.findIndex((o) => o.id === offerId);
  if (index === -1) return null;

  return {
    rank: index + 1,
    totalOffers: sortedOffers.length,
    isBest: index === 0,
  };
}

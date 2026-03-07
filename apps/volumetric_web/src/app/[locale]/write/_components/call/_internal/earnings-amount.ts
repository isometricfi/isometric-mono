import type { OptionOffer } from "@/types/options";

const MAX_BTC_INPUT = 100;
const MAX_BTC_DECIMALS = 6;
const MAX_USD_INPUT = 10_000_000;
const MAX_USD_DECIMALS = 2;

export interface WriterCompetitiveness {
  bestPremiumPercent: number | null;
  fillSpeed: "firstOffer" | "fastFill" | "balanced" | "higherYield";
  rank: number;
  totalOffers: number;
}

export function sanitizeWriterBtcInput(input: string): string | null {
  if (input === "") return "";
  if (!/^\d*\.?\d*$/.test(input)) return null;

  if (/^0\d+/.test(input) && !input.startsWith("0.")) {
    input = input.replace(/^0+/, "");
  }

  const parts = input.split(".");
  if (parts.length === 2 && parts[1].length > MAX_BTC_DECIMALS) {
    input = `${parts[0]}.${parts[1].slice(0, MAX_BTC_DECIMALS)}`;
  }

  const numericValue = parseFloat(input);
  if (!Number.isNaN(numericValue) && numericValue >= MAX_BTC_INPUT) {
    return null;
  }

  return input;
}

export function sanitizeWriterUsdInput(input: string): string | null {
  if (input === "") return "";
  if (!/^\d*\.?\d*$/.test(input)) return null;

  if (/^0\d+/.test(input) && !input.startsWith("0.")) {
    input = input.replace(/^0+/, "");
  }

  const parts = input.split(".");
  if (parts.length === 2 && parts[1].length > MAX_USD_DECIMALS) {
    input = `${parts[0]}.${parts[1].slice(0, MAX_USD_DECIMALS)}`;
  }

  const numericValue = parseFloat(input);
  if (!Number.isNaN(numericValue) && numericValue >= MAX_USD_INPUT) {
    return null;
  }

  return input;
}

export function getEarningsSatsForPremiumPercent(
  amountSats: number,
  premiumPercent: number,
): number {
  if (amountSats <= 0 || premiumPercent <= 0) return 0;
  return Math.round(amountSats * (premiumPercent / 100));
}

export function getMinEarningsSats(amountSats: number, premiumValues: number[]): number {
  if (amountSats <= 0 || premiumValues.length === 0) return 0;
  return getEarningsSatsForPremiumPercent(amountSats, premiumValues[0]);
}

export function getMaxEarningsSats(amountSats: number, premiumValues: number[]): number {
  if (amountSats <= 0 || premiumValues.length === 0) return 0;
  return getEarningsSatsForPremiumPercent(amountSats, premiumValues[premiumValues.length - 1]);
}

export function getPremiumPercentFromEarningsSats(
  earningsSats: number,
  amountSats: number,
  premiumValues: number[],
): number {
  if (premiumValues.length === 0) return 0;
  if (amountSats <= 0 || earningsSats <= 0) return premiumValues[0];

  const targetPremiumPercent = (earningsSats / amountSats) * 100;
  return getClosestPremiumPercent(targetPremiumPercent, premiumValues);
}

export function getClosestPremiumPercent(
  targetPremiumPercent: number,
  premiumValues: number[],
): number {
  if (premiumValues.length === 0) return 0;

  let closestPremiumPercent = premiumValues[0];
  let smallestDistance = Math.abs(targetPremiumPercent - closestPremiumPercent);

  for (const premiumValue of premiumValues) {
    const distance = Math.abs(targetPremiumPercent - premiumValue);
    if (distance < smallestDistance) {
      smallestDistance = distance;
      closestPremiumPercent = premiumValue;
    }
  }

  return closestPremiumPercent;
}

export function getDefaultPremiumPercent(premiumValues: number[]): number {
  if (premiumValues.length === 0) return 0;
  const middleIndex = Math.floor(premiumValues.length / 2);
  return premiumValues[middleIndex] ?? premiumValues[0];
}

export function getWriterCompetitiveness(
  offers: OptionOffer[],
  premiumPercent: number,
  amountSats: number,
): WriterCompetitiveness {
  if (offers.length === 0) {
    return {
      bestPremiumPercent: null,
      fillSpeed: "firstOffer",
      rank: 1,
      totalOffers: 1,
    };
  }

  const sortedOffers = [...offers].sort(compareOffersByCompetitiveness);
  let rank = 1;

  for (const offer of sortedOffers) {
    if (wouldHypotheticalOfferRankBefore(offer, premiumPercent, amountSats)) {
      break;
    }
    rank += 1;
  }

  return {
    bestPremiumPercent: sortedOffers[0]?.premium ?? null,
    fillSpeed: getFillSpeedLabel(rank, sortedOffers.length + 1),
    rank,
    totalOffers: sortedOffers.length + 1,
  };
}

function compareOffersByCompetitiveness(a: OptionOffer, b: OptionOffer): number {
  if (a.premium !== b.premium) return a.premium - b.premium;
  if (a.amountSats !== b.amountSats) return b.amountSats - a.amountSats;
  return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
}

function wouldHypotheticalOfferRankBefore(
  existingOffer: OptionOffer,
  premiumPercent: number,
  amountSats: number,
): boolean {
  if (premiumPercent < existingOffer.premium) return true;
  if (premiumPercent > existingOffer.premium) return false;

  if (amountSats > existingOffer.amountSats) return true;
  return false;
}

function getFillSpeedLabel(
  rank: number,
  totalOffers: number,
): "firstOffer" | "fastFill" | "balanced" | "higherYield" {
  if (totalOffers <= 1) return "firstOffer";
  if (rank === 1) return "fastFill";
  if (rank <= Math.ceil(totalOffers / 2)) return "balanced";
  return "higherYield";
}

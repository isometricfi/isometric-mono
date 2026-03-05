import type { OptionOffer } from "@/types/options";

const MAX_BTC_INPUT = 100;
const MAX_BTC_DECIMALS = 6;
const MAX_USD_INPUT = 10_000_000;
const MAX_USD_DECIMALS = 2;

export interface PremiumOfferMatch {
  offer: OptionOffer;
  quantitySats: number;
}

export function sanitizePremiumAmountInput(input: string): string | null {
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

export function sanitizeUsdAmountInput(input: string): string | null {
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

export function findBestOfferForPremiumAmount(
  offers: OptionOffer[],
  premiumAmountSats: number,
  minOfferAmountSats: number,
): PremiumOfferMatch | null {
  if (premiumAmountSats <= 0) return null;

  const sortedOffers = [...offers].sort((a, b) => {
    if (a.premium !== b.premium) return a.premium - b.premium;
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });

  for (const offer of sortedOffers) {
    if (offer.premium <= 0) continue;

    const quantitySats = Math.floor((premiumAmountSats * 100) / offer.premium);
    if (quantitySats < minOfferAmountSats) continue;
    if (quantitySats > offer.amountSats) continue;

    return { offer, quantitySats };
  }

  return null;
}

export function getMaxPremiumAmountSats(offers: OptionOffer[]): number {
  if (offers.length === 0) return 0;

  return Math.max(...offers.map((offer) => Math.floor((offer.amountSats * offer.premium) / 100)));
}

export function getMinPremiumAmountSats(offers: OptionOffer[], minOfferAmountSats: number): number {
  if (offers.length === 0) return 0;

  const minimumPremiumSats = offers
    .filter((offer) => offer.premium > 0)
    .map((offer) => Math.ceil((minOfferAmountSats * offer.premium) / 100));

  if (minimumPremiumSats.length === 0) return 0;
  return Math.min(...minimumPremiumSats);
}

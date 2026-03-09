import type { OptionOffer } from "@/types/options";

export interface PremiumOfferMatch {
  offer: OptionOffer;
  quantitySats: number;
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

import type { OptionOffer } from "@/types/options";

export interface PremiumOfferMatch {
  offer: OptionOffer;
  quantitySats: number;
}

export function findBestOfferForPremiumAmount(
  offers: OptionOffer[],
  premiumAmountSats: number,
  minAcceptOfferAmountSats: number,
  maxAcceptOfferAmountSats: number,
): PremiumOfferMatch | null {
  if (premiumAmountSats <= 0) return null;

  const sortedOffers = [...offers].sort((a, b) => {
    if (a.premium !== b.premium) return a.premium - b.premium;
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });

  for (const offer of sortedOffers) {
    if (offer.premium <= 0) continue;

    const quantitySats = Math.floor((premiumAmountSats * 100) / offer.premium);
    if (quantitySats < minAcceptOfferAmountSats) continue;
    if (quantitySats > maxAcceptOfferAmountSats) continue;
    if (quantitySats > offer.amountSats) continue;

    return { offer, quantitySats };
  }

  return null;
}

export function getMaxPremiumAmountSats(
  offers: OptionOffer[],
  maxAcceptOfferAmountSats: number,
): number {
  if (offers.length === 0) return 0;

  return Math.max(
    ...offers.map((offer) =>
      Math.floor((Math.min(offer.amountSats, maxAcceptOfferAmountSats) * offer.premium) / 100),
    ),
  );
}

export function getMinPremiumAmountSats(
  offers: OptionOffer[],
  minAcceptOfferAmountSats: number,
): number {
  if (offers.length === 0) return 0;

  const minimumPremiumSats = offers
    .filter((offer) => offer.premium > 0)
    .filter((offer) => offer.amountSats >= minAcceptOfferAmountSats)
    .map((offer) => Math.ceil((minAcceptOfferAmountSats * offer.premium) / 100));

  if (minimumPremiumSats.length === 0) return 0;
  return Math.min(...minimumPremiumSats);
}

export function isBalanceInsufficientForPremiumPurchase(
  availableBalanceSats: number,
  minPremiumAmountSats: number,
): boolean {
  return availableBalanceSats < minPremiumAmountSats;
}

export function shouldRequireDepositForPremiumPurchase(
  availableBalanceSats: number,
  minPremiumAmountSats: number,
): boolean {
  if (minPremiumAmountSats <= 0) {
    return false;
  }

  return isBalanceInsufficientForPremiumPurchase(availableBalanceSats, minPremiumAmountSats);
}

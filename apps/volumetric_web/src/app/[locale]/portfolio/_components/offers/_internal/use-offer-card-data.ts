import { type PortfolioOffer, useConfig } from "@/hooks";
import { DEFAULT_MIN_ACCEPT_OFFER_AMOUNT_SATS, SATS_PER_BTC, secondsToDays } from "@/lib/utils";

// `live`           – Open and accepting fills above the min size
// `partial`        – PartiallyFilled and still accepting fills
// `processing`     – A fill is being processed
// `below-min`      – Open but remaining size is below the canister minimum
// `filled`         – Fully filled / completed
export type HeadlineKey = "live" | "partial" | "processing" | "below-min" | "filled";

export interface RankInfo {
  rank: number;
  totalOffers: number;
  isBest: boolean;
}

export interface OfferCardData {
  totalSats: number;
  remainingSats: number;
  filledSats: number;
  filledPercent: number;
  strikeBpsPercent: number;
  premiumBpsPercent: number;
  strikePriceUsd: number | null;
  termDays: number;
  premiumTotalSats: number;
  premiumRemainingSats: number;
  earningsBtc: number;
  earningsUsd: number;
  earningsRemainingBtc: number;
  earningsRemainingUsd: number;
  apyPercent: number;
  belowMinOfferAmount: boolean;
  minAcceptOfferAmountSats: number;
  createdAt: Date;
  validUntil: Date;
  rankInfo: RankInfo | null;
  headlineKey: HeadlineKey;
}

export function useOfferCardData(
  offer: PortfolioOffer,
  btcPrice: number,
  rankInfo?: RankInfo | null,
): OfferCardData {
  const { data: config } = useConfig();
  const minAcceptOfferAmountSats =
    config?.minAcceptOfferAmountSats ?? DEFAULT_MIN_ACCEPT_OFFER_AMOUNT_SATS;

  const totalSats = Number(offer.totalQuantity);
  const remainingSats = Number(offer.remainingQuantity);
  const filledSats = totalSats - remainingSats;
  const filledPercent = totalSats > 0 ? (filledSats / totalSats) * 100 : 0;

  const strikeBpsPercent = offer.strikeBasisPoints / 100;
  const premiumBpsPercent = offer.premiumBasisPoints / 100;
  const strikePriceUsd = btcPrice > 0 ? btcPrice * (1 + offer.strikeBasisPoints / 10000) : null;

  const termDays = secondsToDays(offer.optionDurationSeconds);
  const premiumTotalSats = (totalSats * offer.premiumBasisPoints) / 10000;
  const premiumRemainingSats = (remainingSats * offer.premiumBasisPoints) / 10000;
  const earningsBtc = premiumTotalSats / SATS_PER_BTC;
  const earningsUsd = earningsBtc * btcPrice;
  const earningsRemainingBtc = premiumRemainingSats / SATS_PER_BTC;
  const earningsRemainingUsd = earningsRemainingBtc * btcPrice;

  const apyPercent =
    totalSats > 0 && termDays > 0 ? (premiumTotalSats / totalSats) * (365 / termDays) * 100 : 0;

  const belowMinOfferAmount = remainingSats < minAcceptOfferAmountSats;

  const createdAt = new Date(Number(offer.createdAt) * 1_000);
  const validUntil = new Date(Number(offer.offerValidUntil) * 1_000);

  const headlineKey: HeadlineKey =
    offer.status === "Processing"
      ? "processing"
      : remainingSats === 0
        ? "filled"
        : belowMinOfferAmount
          ? "below-min"
          : offer.status === "PartiallyFilled"
            ? "partial"
            : "live";

  return {
    totalSats,
    remainingSats,
    filledSats,
    filledPercent,
    strikeBpsPercent,
    premiumBpsPercent,
    strikePriceUsd,
    termDays,
    premiumTotalSats,
    premiumRemainingSats,
    earningsBtc,
    earningsUsd,
    earningsRemainingBtc,
    earningsRemainingUsd,
    apyPercent,
    belowMinOfferAmount,
    minAcceptOfferAmountSats,
    createdAt,
    validUntil,
    rankInfo: rankInfo ?? null,
    headlineKey,
  };
}

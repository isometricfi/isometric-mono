import type { ActiveOption, Offer } from "@volumetric/canister-types";
import type { OptionOffer, OptionsData, StrikeBucket, TermGroup } from "@/types/options";
import { basisPointsToPercent, roundToN, secondsToDays, secondsToISOString } from "./utils";

export function groupOffersByTermAndStrike(offers: Offer[]): OptionsData {
  const termMap = new Map<number, Map<number, OptionOffer[]>>();

  for (const offer of offers) {
    const termDays = secondsToDays(offer.option_duration_seconds);
    const strikePercent = basisPointsToPercent(offer.strike_basis_points);
    const transformedOffer = transformOffer(offer);

    if (!termMap.has(termDays)) {
      termMap.set(termDays, new Map());
    }

    const strikeMap = termMap.get(termDays)!;
    if (!strikeMap.has(strikePercent)) {
      strikeMap.set(strikePercent, []);
    }

    strikeMap.get(strikePercent)!.push(transformedOffer);
  }

  const termGroups: TermGroup[] = [];

  for (const [term, strikeMap] of termMap) {
    const strikes: StrikeBucket[] = [];
    let earliestExpiry: string | null = null;

    for (const [strikePercent, offerList] of strikeMap) {
      const sortedOffers = offerList.sort((a, b) => a.premium - b.premium);
      const totalLiquiditySats = offerList.reduce((sum, o) => sum + o.amountSats, 0);
      const premiums = offerList.map((o) => o.premium);

      strikes.push({
        strikePercent,
        offers: sortedOffers,
        totalLiquiditySats,
        lowestPremium: Math.min(...premiums),
        highestPremium: Math.max(...premiums),
      });

      for (const offer of offerList) {
        if (!earliestExpiry || offer.expiresAt < earliestExpiry) {
          earliestExpiry = offer.expiresAt;
        }
      }
    }

    strikes.sort((a, b) => a.strikePercent - b.strikePercent);

    termGroups.push({
      term,
      expiryDate: earliestExpiry ?? new Date().toISOString(),
      strikes,
    });
  }

  termGroups.sort((a, b) => a.term - b.term);

  return { termGroups };
}

export function groupActiveOptionsByTermAndStrike(options: ActiveOption[]): OptionsData {
  const termMap = new Map<number, Map<number, OptionOffer[]>>();

  for (const option of options) {
    const transformed = transformActiveOption(option);

    if (!termMap.has(transformed.termDays)) {
      termMap.set(transformed.termDays, new Map());
    }

    const strikeMap = termMap.get(transformed.termDays)!;
    if (!strikeMap.has(transformed.strikePercent)) {
      strikeMap.set(transformed.strikePercent, []);
    }

    strikeMap.get(transformed.strikePercent)!.push(transformed);
  }

  const termGroups: TermGroup[] = [];

  for (const [term, strikeMap] of termMap) {
    const strikes: StrikeBucket[] = [];
    let earliestExpiry: string | null = null;

    for (const [strikePercent, items] of strikeMap) {
      const sortedItems = items.sort((a, b) => a.premium - b.premium);
      const totalLiquiditySats = items.reduce((sum, o) => sum + o.amountSats, 0);
      const premiums = items.map((o) => o.premium);

      strikes.push({
        strikePercent,
        offers: sortedItems,
        totalLiquiditySats,
        lowestPremium: Math.min(...premiums),
        highestPremium: Math.max(...premiums),
      });

      for (const item of items) {
        if (!earliestExpiry || item.expiresAt < earliestExpiry) {
          earliestExpiry = item.expiresAt;
        }
      }
    }

    strikes.sort((a, b) => a.strikePercent - b.strikePercent);

    termGroups.push({
      term,
      expiryDate: earliestExpiry ?? new Date().toISOString(),
      strikes,
    });
  }

  termGroups.sort((a, b) => a.term - b.term);

  return { termGroups };
}

function transformOffer(offer: Offer): OptionOffer {
  return {
    id: offer.id.toString(),
    writerId: offer.writer.toText(),
    amountSats: Number(offer.remaining_quantity),
    premium: basisPointsToPercent(offer.premium_basis_points),
    strikePercent: basisPointsToPercent(offer.strike_basis_points),
    termDays: secondsToDays(offer.option_duration_seconds),
    createdAt: secondsToISOString(offer.created_at_seconds),
    expiresAt: secondsToISOString(offer.offer_valid_until_seconds),
  };
}

function transformActiveOption(option: ActiveOption): OptionOffer {
  const durationSeconds = option.expiry_seconds - option.accepted_at_seconds;
  const termDays = secondsToDays(durationSeconds);

  const entry = Number(option.entry_price_cents);
  const strike = Number(option.strike_price_cents);
  const strikePercent = entry > 0 ? ((strike - entry) / entry) * 100 : 0;

  const quantity = Number(option.quantity);
  const premiumPaid = Number(option.premium_paid);
  const premium = quantity > 0 ? (premiumPaid / quantity) * 100 : 0;

  return {
    id: option.id.toString(),
    writerId: option.writer.toText(),
    buyerId: option.buyer.toText(),
    amountSats: quantity,
    premium: roundToN(premium, 2),
    strikePercent: roundToN(strikePercent, 2),
    strikeUsd: roundToN(strike / 100, 0),
    termDays,
    createdAt: secondsToISOString(option.accepted_at_seconds),
    expiresAt: secondsToISOString(option.expiry_seconds),
  };
}

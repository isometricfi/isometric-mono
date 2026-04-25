import type { Offer } from "@volumetric/canister-types";
import type { OptionOffer, OptionsData, StrikeBucket, TermGroup } from "@/types/options";
import { basisPointsToPercent, secondsToDays, secondsToISOString } from "./utils";

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

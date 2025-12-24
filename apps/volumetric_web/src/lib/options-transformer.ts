import type { Offer } from "@volumetric/canister-types";
import type { OptionsData, StrikeBucket, TermGroup } from "@/types/options";
import { basisPointsToPercent, nsToISOString, secondsToDays } from "./utils";

export function groupOffersByTermAndStrike(offers: Offer[]): OptionsData {
  const termMap = new Map<number, Map<number, Offer[]>>();

  for (const offer of offers) {
    const termDays = secondsToDays(offer.option_duration_seconds);
    const strikePercent = basisPointsToPercent(offer.strike_basis_points);

    if (!termMap.has(termDays)) {
      termMap.set(termDays, new Map());
    }

    const strikeMap = termMap.get(termDays)!;
    if (!strikeMap.has(strikePercent)) {
      strikeMap.set(strikePercent, []);
    }

    strikeMap.get(strikePercent)!.push(offer);
  }

  const termGroups: TermGroup[] = [];

  for (const [term, strikeMap] of termMap) {
    const strikes: StrikeBucket[] = [];
    let earliestExpiry: string | null = null;

    for (const [strikePercent, offerList] of strikeMap) {
      const sortedOffers = offerList.sort(
        (a, b) => a.premium_basis_points - b.premium_basis_points,
      );
      const totalLiquiditySats = offerList.reduce(
        (sum, o) => sum + o.remaining_quantity,
        BigInt(0),
      );
      const premiums = offerList.map((o) => basisPointsToPercent(o.premium_basis_points));

      strikes.push({
        strikePercent,
        offers: sortedOffers,
        totalLiquiditySats,
        lowestPremium: Math.min(...premiums),
        highestPremium: Math.max(...premiums),
      });

      for (const offer of offerList) {
        const expiryStr = nsToISOString(offer.offer_valid_until);
        if (!earliestExpiry || expiryStr < earliestExpiry) {
          earliestExpiry = expiryStr;
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

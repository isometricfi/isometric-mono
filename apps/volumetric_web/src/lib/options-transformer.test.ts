import { Principal } from "@dfinity/principal";
import type { Offer } from "@volumetric/canister-types";
import { describe, expect, test } from "vitest";
import { groupOffersByTermAndStrike } from "./options-transformer";

const SECONDS_PER_DAY = 86400;
const ONE_DAY_SECONDS = BigInt(86_400);
const DEFAULT_TERM_SECONDS = BigInt(7 * SECONDS_PER_DAY);
const DEFAULT_STRIKE_BP = 1000;
const DEFAULT_PREMIUM_BP = 500;
const DEFAULT_QUANTITY = BigInt(100_000);
const DEFAULT_PRINCIPAL = Principal.fromText("aaaaa-aa");

function makeOffer(overrides: Partial<Offer> = {}): Offer {
  return {
    id: BigInt(1),
    status: { Open: null },
    option_type: { Call: null },
    asset: { CkBtc: null },
    total_quantity: DEFAULT_QUANTITY,
    remaining_quantity: DEFAULT_QUANTITY,
    offer_valid_until_seconds: ONE_DAY_SECONDS,
    created_at_seconds: BigInt(0),
    writer: DEFAULT_PRINCIPAL,
    strike_basis_points: DEFAULT_STRIKE_BP,
    premium_basis_points: DEFAULT_PREMIUM_BP,
    option_duration_seconds: DEFAULT_TERM_SECONDS,
    ...overrides,
  };
}

describe("groupOffersByTermAndStrike", () => {
  test("should return empty termGroups for an empty array", () => {
    // given
    const offers: Offer[] = [];

    // when
    const result = groupOffersByTermAndStrike(offers);

    // then
    expect(result.termGroups).toEqual([]);
  });

  test("should produce a single term group with one strike bucket for a single offer", () => {
    // given
    const offers = [makeOffer()];

    // when
    const result = groupOffersByTermAndStrike(offers);

    // then
    const EXPECTED_TERM_DAYS = 7;
    const EXPECTED_STRIKE_PERCENT = 10;
    const EXPECTED_PREMIUM = 5;
    const EXPECTED_AMOUNT_SATS = 100_000;
    const EXPECTED_EXPIRY = "1970-01-02T00:00:00.000Z";
    const EXPECTED_CREATED_AT = "1970-01-01T00:00:00.000Z";

    expect(result.termGroups).toHaveLength(1);

    const termGroup = result.termGroups[0];
    expect(termGroup.term).toBe(EXPECTED_TERM_DAYS);
    expect(termGroup.expiryDate).toBe(EXPECTED_EXPIRY);
    expect(termGroup.strikes).toHaveLength(1);

    const strike = termGroup.strikes[0];
    expect(strike.strikePercent).toBe(EXPECTED_STRIKE_PERCENT);
    expect(strike.totalLiquiditySats).toBe(EXPECTED_AMOUNT_SATS);
    expect(strike.lowestPremium).toBe(EXPECTED_PREMIUM);
    expect(strike.highestPremium).toBe(EXPECTED_PREMIUM);
    expect(strike.offers).toHaveLength(1);

    const offer = strike.offers[0];
    expect(offer.id).toBe("1");
    expect(offer.writerId).toBe("aaaaa-aa");
    expect(offer.amountSats).toBe(EXPECTED_AMOUNT_SATS);
    expect(offer.premium).toBe(EXPECTED_PREMIUM);
    expect(offer.strikePercent).toBe(EXPECTED_STRIKE_PERCENT);
    expect(offer.termDays).toBe(EXPECTED_TERM_DAYS);
    expect(offer.createdAt).toBe(EXPECTED_CREATED_AT);
    expect(offer.expiresAt).toBe(EXPECTED_EXPIRY);
  });

  test("should group multiple offers with the same term and strike into one bucket", () => {
    // given
    const offerA = makeOffer({ id: BigInt(1), remaining_quantity: BigInt(50_000) });
    const offerB = makeOffer({ id: BigInt(2), remaining_quantity: BigInt(75_000) });
    const offers = [offerA, offerB];

    // when
    const result = groupOffersByTermAndStrike(offers);

    // then
    const EXPECTED_OFFER_COUNT = 2;
    const EXPECTED_TOTAL_LIQUIDITY = 125_000;

    expect(result.termGroups).toHaveLength(1);
    expect(result.termGroups[0].strikes).toHaveLength(1);

    const bucket = result.termGroups[0].strikes[0];
    expect(bucket.offers).toHaveLength(EXPECTED_OFFER_COUNT);
    expect(bucket.totalLiquiditySats).toBe(EXPECTED_TOTAL_LIQUIDITY);
  });

  test("should produce multiple strike buckets for offers with same term but different strikes", () => {
    // given
    const lowStrikeBp = 500;
    const highStrikeBp = 2000;
    const offerA = makeOffer({ id: BigInt(1), strike_basis_points: lowStrikeBp });
    const offerB = makeOffer({ id: BigInt(2), strike_basis_points: highStrikeBp });
    const offers = [offerA, offerB];

    // when
    const result = groupOffersByTermAndStrike(offers);

    // then
    const EXPECTED_LOW_STRIKE_PERCENT = 5;
    const EXPECTED_HIGH_STRIKE_PERCENT = 20;

    expect(result.termGroups).toHaveLength(1);
    expect(result.termGroups[0].strikes).toHaveLength(2);
    expect(result.termGroups[0].strikes[0].strikePercent).toBe(EXPECTED_LOW_STRIKE_PERCENT);
    expect(result.termGroups[0].strikes[1].strikePercent).toBe(EXPECTED_HIGH_STRIKE_PERCENT);
  });

  test("should produce multiple term groups for offers with different terms", () => {
    // given
    const sevenDayTermSeconds = BigInt(7 * SECONDS_PER_DAY);
    const fourteenDayTermSeconds = BigInt(14 * SECONDS_PER_DAY);
    const offerA = makeOffer({ id: BigInt(1), option_duration_seconds: sevenDayTermSeconds });
    const offerB = makeOffer({ id: BigInt(2), option_duration_seconds: fourteenDayTermSeconds });
    const offers = [offerA, offerB];

    // when
    const result = groupOffersByTermAndStrike(offers);

    // then
    const EXPECTED_SHORT_TERM = 7;
    const EXPECTED_LONG_TERM = 14;

    expect(result.termGroups).toHaveLength(2);
    expect(result.termGroups[0].term).toBe(EXPECTED_SHORT_TERM);
    expect(result.termGroups[1].term).toBe(EXPECTED_LONG_TERM);
  });

  test("should sort offers within a strike bucket by premium ascending", () => {
    // given
    const highPremiumBp = 800;
    const lowPremiumBp = 300;
    const midPremiumBp = 500;
    const offerHigh = makeOffer({ id: BigInt(1), premium_basis_points: highPremiumBp });
    const offerLow = makeOffer({ id: BigInt(2), premium_basis_points: lowPremiumBp });
    const offerMid = makeOffer({ id: BigInt(3), premium_basis_points: midPremiumBp });
    const offers = [offerHigh, offerLow, offerMid];

    // when
    const result = groupOffersByTermAndStrike(offers);

    // then
    const EXPECTED_PREMIUMS_ASC = [3, 5, 8];

    const premiums = result.termGroups[0].strikes[0].offers.map((o) => o.premium);
    expect(premiums).toEqual(EXPECTED_PREMIUMS_ASC);
  });

  test("should sort strike buckets within a term group by strikePercent ascending", () => {
    // given
    const highStrikeBp = 3000;
    const lowStrikeBp = 500;
    const midStrikeBp = 1500;
    const offerHigh = makeOffer({ id: BigInt(1), strike_basis_points: highStrikeBp });
    const offerLow = makeOffer({ id: BigInt(2), strike_basis_points: lowStrikeBp });
    const offerMid = makeOffer({ id: BigInt(3), strike_basis_points: midStrikeBp });
    const offers = [offerHigh, offerLow, offerMid];

    // when
    const result = groupOffersByTermAndStrike(offers);

    // then
    const EXPECTED_STRIKES_ASC = [5, 15, 30];

    const strikes = result.termGroups[0].strikes.map((s) => s.strikePercent);
    expect(strikes).toEqual(EXPECTED_STRIKES_ASC);
  });

  test("should sort term groups by term ascending", () => {
    // given
    const thirtyDayTermSeconds = BigInt(30 * SECONDS_PER_DAY);
    const sevenDayTermSeconds = BigInt(7 * SECONDS_PER_DAY);
    const fourteenDayTermSeconds = BigInt(14 * SECONDS_PER_DAY);
    const offerLong = makeOffer({ id: BigInt(1), option_duration_seconds: thirtyDayTermSeconds });
    const offerShort = makeOffer({ id: BigInt(2), option_duration_seconds: sevenDayTermSeconds });
    const offerMid = makeOffer({ id: BigInt(3), option_duration_seconds: fourteenDayTermSeconds });
    const offers = [offerLong, offerShort, offerMid];

    // when
    const result = groupOffersByTermAndStrike(offers);

    // then
    const EXPECTED_TERMS_ASC = [7, 14, 30];

    const terms = result.termGroups.map((tg) => tg.term);
    expect(terms).toEqual(EXPECTED_TERMS_ASC);
  });

  test("should calculate totalLiquiditySats as the sum of amountSats in a bucket", () => {
    // given
    const quantityA = BigInt(40_000);
    const quantityB = BigInt(60_000);
    const quantityC = BigInt(25_000);
    const offerA = makeOffer({ id: BigInt(1), remaining_quantity: quantityA });
    const offerB = makeOffer({ id: BigInt(2), remaining_quantity: quantityB });
    const offerC = makeOffer({ id: BigInt(3), remaining_quantity: quantityC });
    const offers = [offerA, offerB, offerC];

    // when
    const result = groupOffersByTermAndStrike(offers);

    // then
    const EXPECTED_TOTAL_LIQUIDITY = 125_000;

    expect(result.termGroups[0].strikes[0].totalLiquiditySats).toBe(EXPECTED_TOTAL_LIQUIDITY);
  });

  test("should compute correct lowestPremium and highestPremium for a bucket", () => {
    // given
    const lowPremiumBp = 200;
    const midPremiumBp = 750;
    const highPremiumBp = 1200;
    const offerLow = makeOffer({ id: BigInt(1), premium_basis_points: lowPremiumBp });
    const offerMid = makeOffer({ id: BigInt(2), premium_basis_points: midPremiumBp });
    const offerHigh = makeOffer({ id: BigInt(3), premium_basis_points: highPremiumBp });
    const offers = [offerMid, offerHigh, offerLow];

    // when
    const result = groupOffersByTermAndStrike(offers);

    // then
    const EXPECTED_LOWEST_PREMIUM = 2;
    const EXPECTED_HIGHEST_PREMIUM = 12;

    const bucket = result.termGroups[0].strikes[0];
    expect(bucket.lowestPremium).toBe(EXPECTED_LOWEST_PREMIUM);
    expect(bucket.highestPremium).toBe(EXPECTED_HIGHEST_PREMIUM);
  });

  test("should pick the earliest expiresAt across all offers in a term group", () => {
    // given
    const earliestExpirySeconds = ONE_DAY_SECONDS;
    const middleExpirySeconds = ONE_DAY_SECONDS * BigInt(3);
    const latestExpirySeconds = ONE_DAY_SECONDS * BigInt(5);
    const lowStrikeBp = 500;
    const highStrikeBp = 2000;
    const offerEarly = makeOffer({
      id: BigInt(1),
      offer_valid_until_seconds: earliestExpirySeconds,
      strike_basis_points: lowStrikeBp,
    });
    const offerMiddle = makeOffer({
      id: BigInt(2),
      offer_valid_until_seconds: middleExpirySeconds,
      strike_basis_points: lowStrikeBp,
    });
    const offerLate = makeOffer({
      id: BigInt(3),
      offer_valid_until_seconds: latestExpirySeconds,
      strike_basis_points: highStrikeBp,
    });
    const offers = [offerLate, offerMiddle, offerEarly];

    // when
    const result = groupOffersByTermAndStrike(offers);

    // then
    const EXPECTED_EARLIEST_EXPIRY = "1970-01-02T00:00:00.000Z";

    expect(result.termGroups).toHaveLength(1);
    expect(result.termGroups[0].expiryDate).toBe(EXPECTED_EARLIEST_EXPIRY);
  });
});

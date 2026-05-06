const SECONDS_PER_DAY = BigInt(86_400);
const DAYS_PER_CALENDAR_YEAR = BigInt(365);
const DEFAULT_LISTING_WINDOW_YEARS = BigInt(10);
const LISTING_WINDOW_LEEWAY_YEARS = BigInt(1);

export const OFFER_VALID_UNTIL_DEFAULT_OFFSET_SECONDS =
  SECONDS_PER_DAY * DAYS_PER_CALENDAR_YEAR * DEFAULT_LISTING_WINDOW_YEARS;

export const OFFER_VALID_UNTIL_LEEWAY_SECONDS =
  SECONDS_PER_DAY * DAYS_PER_CALENDAR_YEAR * LISTING_WINDOW_LEEWAY_YEARS;

export function offerValidUntilAcceptableRange(nowSeconds: bigint): {
  minInclusive: bigint;
  maxInclusive: bigint;
} {
  const minInclusive =
    nowSeconds + OFFER_VALID_UNTIL_DEFAULT_OFFSET_SECONDS - OFFER_VALID_UNTIL_LEEWAY_SECONDS;
  const maxInclusive =
    nowSeconds + OFFER_VALID_UNTIL_DEFAULT_OFFSET_SECONDS + OFFER_VALID_UNTIL_LEEWAY_SECONDS;
  return { minInclusive, maxInclusive };
}

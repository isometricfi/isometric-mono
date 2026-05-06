import { describe, expect, test } from "vitest";
import {
  OFFER_VALID_UNTIL_DEFAULT_OFFSET_SECONDS,
  OFFER_VALID_UNTIL_LEEWAY_SECONDS,
  offerValidUntilAcceptableRange,
} from "./offer-valid-until-policy";

describe("offerValidUntilAcceptableRange", () => {
  test("should return min and max as default offset plus minus one calendar year from anchor", () => {
    // given
    const nowSeconds = 1_700_000_000n;

    // when
    const { minInclusive, maxInclusive } = offerValidUntilAcceptableRange(nowSeconds);

    // then
    const expectedMin =
      nowSeconds + OFFER_VALID_UNTIL_DEFAULT_OFFSET_SECONDS - OFFER_VALID_UNTIL_LEEWAY_SECONDS;
    const expectedMax =
      nowSeconds + OFFER_VALID_UNTIL_DEFAULT_OFFSET_SECONDS + OFFER_VALID_UNTIL_LEEWAY_SECONDS;
    expect(minInclusive).toBe(expectedMin);
    expect(maxInclusive).toBe(expectedMax);
  });
});

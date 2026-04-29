import { describe, expect, test } from "vitest";
import { fromUsdMicros, toUsdMicros } from "./drizzle-market-data.repository";

describe("USD micros conversion", () => {
  test("should preserve Bitcoin USD prices across storage conversion", () => {
    // given
    const PRICE_USD = 62_345.123456;
    const EXPECTED_PRICE_USD_MICROS = 62_345_123_456;

    // when
    const priceUsdMicros = toUsdMicros(PRICE_USD);
    const restoredPriceUsd = fromUsdMicros(priceUsdMicros);

    // then
    expect(priceUsdMicros).toBe(EXPECTED_PRICE_USD_MICROS);
    expect(restoredPriceUsd).toBe(PRICE_USD);
  });
});

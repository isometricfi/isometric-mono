import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import {
  OFFER_VALID_UNTIL_DEFAULT_OFFSET_SECONDS,
  offerValidUntilAcceptableRange,
} from "./offer-valid-until-policy";
import { inputSchema } from "./schema";

describe("createOffer inputSchema", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-06-15T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test("should accept payload when offer valid until matches default window and challenge expiry is in policy", () => {
    // given
    const nowSeconds = BigInt(Math.floor(Date.now() / 1000));
    const offerValidUntilSeconds = nowSeconds + OFFER_VALID_UNTIL_DEFAULT_OFFSET_SECONDS;
    const expiresAtSeconds = nowSeconds + 300n;
    const payload = {
      address: "bc1qexample000000000000000000000000000000",
      signature: "deadbeef",
      expiresAtSeconds: expiresAtSeconds.toString(),
      quantity: "1000000",
      strikeBasisPoints: 500,
      premiumBasisPoints: 100,
      offerValidUntilSeconds: offerValidUntilSeconds.toString(),
      optionDurationSeconds: "259200",
    };

    // when
    const result = inputSchema.safeParse(payload);

    // then
    expect(result.success).toBe(true);
  });

  test("should reject when offer valid until is one second below acceptable minimum", () => {
    // given
    const nowSeconds = BigInt(Math.floor(Date.now() / 1000));
    const { minInclusive } = offerValidUntilAcceptableRange(nowSeconds);
    const tooEarly = minInclusive - 1n;
    const expiresAtSeconds = nowSeconds + 300n;
    const payload = {
      address: "bc1qexample000000000000000000000000000000",
      signature: "deadbeef",
      expiresAtSeconds: expiresAtSeconds.toString(),
      quantity: "1000000",
      strikeBasisPoints: 500,
      premiumBasisPoints: 100,
      offerValidUntilSeconds: tooEarly.toString(),
      optionDurationSeconds: "259200",
    };

    // when
    const result = inputSchema.safeParse(payload);

    // then
    expect(result.success).toBe(false);
  });

  test("should reject when expiresAtSeconds is more than 600 seconds after server now", () => {
    // given
    const nowSeconds = BigInt(Math.floor(Date.now() / 1000));
    const offerValidUntilSeconds = nowSeconds + OFFER_VALID_UNTIL_DEFAULT_OFFSET_SECONDS;
    const expiresAtSeconds = nowSeconds + 601n;
    const payload = {
      address: "bc1qexample000000000000000000000000000000",
      signature: "deadbeef",
      expiresAtSeconds: expiresAtSeconds.toString(),
      quantity: "1000000",
      strikeBasisPoints: 500,
      premiumBasisPoints: 100,
      offerValidUntilSeconds: offerValidUntilSeconds.toString(),
      optionDurationSeconds: "259200",
    };

    // when
    const result = inputSchema.safeParse(payload);

    // then
    expect(result.success).toBe(false);
  });
});

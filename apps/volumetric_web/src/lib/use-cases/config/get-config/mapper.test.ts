import { afterEach, describe, expect, test, vi } from "vitest";
import { mapConfig } from "./mapper";

const SECONDS_PER_DAY = 86_400;

function daysToSecondsRange(minDays: number, maxDays: number) {
  return {
    min: BigInt(minDays * SECONDS_PER_DAY),
    max: BigInt(maxDays * SECONDS_PER_DAY),
  };
}

function makeValidLimits(overrides: Record<string, unknown> = {}) {
  return {
    create_offer_quantity_sats: { min: BigInt(10_000), max: BigInt(1_000_000) },
    accept_offer_quantity_sats: { min: BigInt(5_000), max: BigInt(500_000) },
    premium_basis_points: { min: 100, max: 5_000 },
    strike_basis_points: { min: 500, max: 2_000 },
    option_duration_seconds: daysToSecondsRange(3, 7),
    deposit_amount_sats: BigInt(5_000),
    withdraw_amount_sats: BigInt(5_000),
    ...overrides,
  };
}

function makeValidFeeConfig(overrides: Record<string, unknown> = {}) {
  return {
    premium_fee_basis_points: BigInt(50),
    profit_fee_basis_points: BigInt(100),
    fee_recipient: { toText: () => "aaaaa-aa" },
    ...overrides,
  };
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("mapConfig", () => {
  test("should map all fields with default 3-7 day range", () => {
    // given
    delete process.env.CANISTER_ID;
    delete process.env.IC_HOST;
    const limits = makeValidLimits();
    const feeConfig = makeValidFeeConfig();

    // when
    const result = mapConfig(limits, feeConfig, BigInt(10));

    // then
    expect(result).toEqual({
      canisterId: undefined,
      icHost: "https://ic0.app",
      termOptions: [3, 7],
      strikePercentOptions: [3, 5, 8],
      premium: { min: 1, max: 50, step: 0.1 },
      minCreateOfferAmountSats: 10_000,
      maxCreateOfferAmountSats: 1_000_000,
      minAcceptOfferAmountSats: 5_000,
      maxAcceptOfferAmountSats: 500_000,
      minDepositAmountSats: 5_000,
      minWithdrawAmountSats: 5_000,
      ckbtcTransferFeeSats: 10,
      minTermDays: 3,
      maxTermDays: 7,
      fees: {
        premiumFeeBasisPoints: BigInt(50),
        profitFeeBasisPoints: BigInt(100),
        feeRecipient: "aaaaa-aa",
      },
    });
  });

  test("should filter term options to narrow 7-7 range", () => {
    // given
    const limits = makeValidLimits({
      option_duration_seconds: daysToSecondsRange(7, 7),
    });

    // when
    const result = mapConfig(limits, makeValidFeeConfig(), BigInt(10));

    // then
    expect(result.termOptions).toEqual([7]);
  });

  test("should return empty term options when no default day fits the range", () => {
    // given
    const limits = makeValidLimits({
      option_duration_seconds: daysToSecondsRange(20, 30),
    });

    // when
    const result = mapConfig(limits, makeValidFeeConfig(), BigInt(10));

    // then
    expect(result.termOptions).toEqual([]);
    expect(result.minTermDays).toBe(0);
    expect(result.maxTermDays).toBe(0);
  });

  test("should include days whose exact seconds fit a sub-day minimum", () => {
    // given
    const limits = makeValidLimits({
      option_duration_seconds: { min: BigInt(3_600), max: BigInt(30 * SECONDS_PER_DAY) },
    });

    // when
    const result = mapConfig(limits, makeValidFeeConfig(), BigInt(10));

    // then
    expect(result.termOptions).toEqual([3, 7]);
    expect(result.minTermDays).toBe(3);
    expect(result.maxTermDays).toBe(7);
  });

  test("should return empty term options when max is under one day", () => {
    // given
    const limits = makeValidLimits({
      option_duration_seconds: { min: BigInt(3_600), max: BigInt(43_200) },
    });

    // when
    const result = mapConfig(limits, makeValidFeeConfig(), BigInt(10));

    // then
    expect(result.termOptions).toEqual([]);
    expect(result.minTermDays).toBe(0);
    expect(result.maxTermDays).toBe(0);
  });

  test("should return empty term options when min exceeds max", () => {
    // given
    const limits = makeValidLimits({
      option_duration_seconds: {
        min: BigInt(30 * SECONDS_PER_DAY),
        max: BigInt(10 * SECONDS_PER_DAY),
      },
    });

    // when
    const result = mapConfig(limits, makeValidFeeConfig(), BigInt(10));

    // then
    expect(result.termOptions).toEqual([]);
  });

  test("should throw Zod error for invalid limits", () => {
    // given / when / then
    expect(() =>
      mapConfig({ option_duration_seconds: "bad" }, makeValidFeeConfig(), BigInt(10)),
    ).toThrow();
  });

  test("should use env vars when set", () => {
    // given
    vi.stubEnv("CANISTER_ID", "rrkah-fqaaa-aaaaa-aaaaq-cai");
    vi.stubEnv("IC_HOST", "https://custom.example.com");

    // when
    const result = mapConfig(makeValidLimits(), makeValidFeeConfig(), BigInt(10));

    // then
    expect(result.canisterId).toBe("rrkah-fqaaa-aaaaa-aaaaq-cai");
    expect(result.icHost).toBe("https://custom.example.com");
  });
});

import { afterEach, describe, expect, test, vi } from "vitest";
import { mapConfig } from "./mapper";

function makeValidLimits(overrides: Record<string, unknown> = {}) {
  return {
    term_days: { min: BigInt(1), max: BigInt(14) },
    create_offer_quantity_sats: { min: BigInt(10_000), max: BigInt(1_000_000) },
    accept_offer_quantity_sats: { min: BigInt(5_000), max: BigInt(500_000) },
    premium_basis_points: { min: 100, max: 5_000 },
    strike_basis_points: { min: 500, max: 2_000 },
    option_duration_seconds: { min: BigInt(86_400), max: BigInt(1_209_600) },
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
  test("should map all fields with default 1-14 day range", () => {
    // given
    delete process.env.CANISTER_ID;
    delete process.env.IC_HOST;
    const limits = makeValidLimits();
    const feeConfig = makeValidFeeConfig();

    // when
    const result = mapConfig(limits, feeConfig);

    // then
    expect(result).toEqual({
      canisterId: undefined,
      icHost: "https://ic0.app",
      termOptions: [1, 7, 14],
      strikePercentOptions: [5, 10, 15, 20],
      premium: { min: 1, max: 50, step: 0.25 },
      minCreateOfferAmountSats: 10_000,
      maxCreateOfferAmountSats: 1_000_000,
      minAcceptOfferAmountSats: 5_000,
      maxAcceptOfferAmountSats: 500_000,
      minDepositAmountSats: 5_000,
      minWithdrawAmountSats: 5_000,
      minTermDays: 1,
      maxTermDays: 14,
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
      term_days: { min: BigInt(7), max: BigInt(7) },
    });

    // when
    const result = mapConfig(limits, makeValidFeeConfig());

    // then
    expect(result.termOptions).toEqual([7]);
  });

  test("should fall back to min term days when no defaults fit range", () => {
    // given
    const limits = makeValidLimits({
      term_days: { min: BigInt(20), max: BigInt(30) },
    });

    // when
    const result = mapConfig(limits, makeValidFeeConfig());

    // then
    expect(result.termOptions).toEqual([20]);
  });

  test("should throw when minTermDays exceeds maxTermDays", () => {
    // given
    const limits = makeValidLimits({
      term_days: { min: BigInt(30), max: BigInt(10) },
    });

    // when / then
    expect(() => mapConfig(limits, makeValidFeeConfig())).toThrow("Invalid term limits");
  });

  test("should throw Zod error for invalid limits", () => {
    // given / when / then
    expect(() => mapConfig({ term_days: "bad" }, makeValidFeeConfig())).toThrow();
  });

  test("should use env vars when set", () => {
    // given
    vi.stubEnv("CANISTER_ID", "rrkah-fqaaa-aaaaa-aaaaq-cai");
    vi.stubEnv("IC_HOST", "https://custom.example.com");

    // when
    const result = mapConfig(makeValidLimits(), makeValidFeeConfig());

    // then
    expect(result.canisterId).toBe("rrkah-fqaaa-aaaaa-aaaaq-cai");
    expect(result.icHost).toBe("https://custom.example.com");
  });
});

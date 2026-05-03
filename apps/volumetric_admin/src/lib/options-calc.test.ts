import { describe, expect, test } from "vitest";
import {
  calculateOptions,
  dollarsToCents,
  formatDollarsFromCents,
  formatSatsDisplay,
} from "./options-calc";

describe("dollarsToCents", () => {
  test("should convert whole dollar string to cents", () => {
    const cents = dollarsToCents("79514");
    expect(cents).toBe(7951400n);
  });

  test("should convert decimal dollar string to cents with rounding", () => {
    const cents = dollarsToCents("79514.42");
    expect(cents).toBe(7951442n);
  });

  test("should throw for non-numeric input", () => {
    expect(() => dollarsToCents("abc")).toThrow();
  });

  test("should throw for negative input", () => {
    expect(() => dollarsToCents("-5")).toThrow();
  });
});

describe("formatDollarsFromCents", () => {
  test("should format cents as dollars", () => {
    expect(formatDollarsFromCents(7951400n)).toBe("$79,514.00");
  });

  test("should format cents with fractional part", () => {
    expect(formatDollarsFromCents(8189942n)).toBe("$81,899.42");
  });
});

describe("formatSatsDisplay", () => {
  test("should format sats with locale separators", () => {
    expect(formatSatsDisplay(14200n)).toBe("14,200 sats");
  });

  test("should format zero sats", () => {
    expect(formatSatsDisplay(0n)).toBe("0 sats");
  });
});

describe("calculateOptions", () => {
  const ENTRY_PRICE_CENTS = 7951400n;
  const STRIKE_BPS = 300n;
  const OPTION_SIZE_SATS = 14200n;
  const PREMIUM_BPS = 100n;
  const SETTLEMENT_PRICE_CENTS = 10000000n;
  const PREMIUM_FEE_BPS = 500n;
  const PROFIT_FEE_BPS = 2000n;
  const TRANSFER_FEE_SATS = 10n;

  test("should calculate correct uplift and strike from given example", () => {
    // given
    // using constants above

    // when
    const results = calculateOptions({
      entryPriceCents: ENTRY_PRICE_CENTS,
      strikeBps: STRIKE_BPS,
      optionSizeSats: OPTION_SIZE_SATS,
      premiumBps: PREMIUM_BPS,
      settlementPriceCents: SETTLEMENT_PRICE_CENTS,
      premiumFeeBps: PREMIUM_FEE_BPS,
      profitFeeBps: PROFIT_FEE_BPS,
      ckbtcTransferFeeSats: TRANSFER_FEE_SATS,
    });

    // then
    expect(results.upliftPriceCents).toBe(238542n);
    expect(results.strikePriceCents).toBe(8189942n);
  });

  test("should calculate correct gross premium (integer floor division)", () => {
    // given
    // using constants above

    // when
    const results = calculateOptions({
      entryPriceCents: ENTRY_PRICE_CENTS,
      strikeBps: STRIKE_BPS,
      optionSizeSats: OPTION_SIZE_SATS,
      premiumBps: PREMIUM_BPS,
      settlementPriceCents: SETTLEMENT_PRICE_CENTS,
      premiumFeeBps: PREMIUM_FEE_BPS,
      profitFeeBps: PROFIT_FEE_BPS,
      ckbtcTransferFeeSats: TRANSFER_FEE_SATS,
    });

    // then
    const EXPECTED_GROSS_PREMIUM_SATS = 142n;
    expect(results.grossPremiumSats).toBe(EXPECTED_GROSS_PREMIUM_SATS);
  });

  test("should calculate correct premium fee (floor division)", () => {
    // given
    // using constants above

    // when
    const results = calculateOptions({
      entryPriceCents: ENTRY_PRICE_CENTS,
      strikeBps: STRIKE_BPS,
      optionSizeSats: OPTION_SIZE_SATS,
      premiumBps: PREMIUM_BPS,
      settlementPriceCents: SETTLEMENT_PRICE_CENTS,
      premiumFeeBps: PREMIUM_FEE_BPS,
      profitFeeBps: PROFIT_FEE_BPS,
      ckbtcTransferFeeSats: TRANSFER_FEE_SATS,
    });

    // then
    const EXPECTED_PREMIUM_FEE_SATS = 7n;
    expect(results.premiumFeeSats).toBe(EXPECTED_PREMIUM_FEE_SATS);
  });

  test("should calculate correct writer net premium", () => {
    // given
    // using constants above

    // when
    const results = calculateOptions({
      entryPriceCents: ENTRY_PRICE_CENTS,
      strikeBps: STRIKE_BPS,
      optionSizeSats: OPTION_SIZE_SATS,
      premiumBps: PREMIUM_BPS,
      settlementPriceCents: SETTLEMENT_PRICE_CENTS,
      premiumFeeBps: PREMIUM_FEE_BPS,
      profitFeeBps: PROFIT_FEE_BPS,
      ckbtcTransferFeeSats: TRANSFER_FEE_SATS,
    });

    // then
    const EXPECTED_WRITER_NET_PREMIUM_SATS = 135n;
    expect(results.writerPremiumSats).toBe(EXPECTED_WRITER_NET_PREMIUM_SATS);
  });

  test("should calculate correct gross buyer payout, profit fee, and buyer net", () => {
    // given
    // using constants above (ITM scenario)

    // when
    const results = calculateOptions({
      entryPriceCents: ENTRY_PRICE_CENTS,
      strikeBps: STRIKE_BPS,
      optionSizeSats: OPTION_SIZE_SATS,
      premiumBps: PREMIUM_BPS,
      settlementPriceCents: SETTLEMENT_PRICE_CENTS,
      premiumFeeBps: PREMIUM_FEE_BPS,
      profitFeeBps: PROFIT_FEE_BPS,
      ckbtcTransferFeeSats: TRANSFER_FEE_SATS,
    });

    // then
    const EXPECTED_GROSS_PAYOUT_SATS = 2570n;
    const EXPECTED_PROFIT_FEE_SATS = 514n;
    const EXPECTED_BUYER_NET_SATS = 2056n;

    expect(results.isInTheMoney).toBe(true);
    expect(results.profitCents).toBe(1810058n);
    expect(results.grossBuyerPayoutSats).toBe(EXPECTED_GROSS_PAYOUT_SATS);
    expect(results.profitFeeSats).toBe(EXPECTED_PROFIT_FEE_SATS);
    expect(results.buyerNetSats).toBe(EXPECTED_BUYER_NET_SATS);
  });

  test("should calculate correct writer collateral remainder and writer returned", () => {
    // given
    // using constants above

    // when
    const results = calculateOptions({
      entryPriceCents: ENTRY_PRICE_CENTS,
      strikeBps: STRIKE_BPS,
      optionSizeSats: OPTION_SIZE_SATS,
      premiumBps: PREMIUM_BPS,
      settlementPriceCents: SETTLEMENT_PRICE_CENTS,
      premiumFeeBps: PREMIUM_FEE_BPS,
      profitFeeBps: PROFIT_FEE_BPS,
      ckbtcTransferFeeSats: TRANSFER_FEE_SATS,
    });

    // then
    const EXPECTED_COLLATERAL_REMAINDER_SATS = 11630n;
    const EXPECTED_WRITER_RETURNED_SATS = 11610n;

    expect(results.writerCollateralRemainderSats).toBe(EXPECTED_COLLATERAL_REMAINDER_SATS);
    expect(results.writerReturnedSats).toBe(EXPECTED_WRITER_RETURNED_SATS);
  });

  test("should return out of the money when settlement <= strike", () => {
    // given
    const ENTRY_CENTS = 7951400n;
    const STRIKE_BPS_5PCT = 500n;
    const Q_SATS = 100_000_000n;
    const PREMIUM_BPS_1PCT = 100n;
    const SETTLEMENT_AT_STRIKE_CENTS = 8348970n; // 79514 * (1 + 500/10000) * 100
    const FEE_BPS = 500n;
    const PROFIT_BPS = 2000n;
    const XFER_FEE = 10n;

    // when
    const results = calculateOptions({
      entryPriceCents: ENTRY_CENTS,
      strikeBps: STRIKE_BPS_5PCT,
      optionSizeSats: Q_SATS,
      premiumBps: PREMIUM_BPS_1PCT,
      settlementPriceCents: SETTLEMENT_AT_STRIKE_CENTS,
      premiumFeeBps: FEE_BPS,
      profitFeeBps: PROFIT_BPS,
      ckbtcTransferFeeSats: XFER_FEE,
    });

    // then
    expect(results.isInTheMoney).toBe(false);
    expect(results.profitCents).toBe(0n);
    expect(results.grossBuyerPayoutSats).toBe(0n);
    expect(results.profitFeeSats).toBe(0n);
    expect(results.buyerNetSats).toBe(0n);
    expect(results.writerCollateralRemainderSats).toBe(Q_SATS);
    expect(results.writerReturnedSats).toBe(Q_SATS);
  });

  test("should return out of the money when settlement < strike", () => {
    // given
    const ENTRY_CENTS = 7951400n;
    const STRIKE_BPS_5PCT = 500n;
    const Q_SATS = 100_000_000n;
    const PREMIUM_BPS_1PCT = 100n;
    const SETTLEMENT_BELOW_STRIKE_CENTS = 8000000n;
    const FEE_BPS = 500n;
    const PROFIT_BPS = 2000n;
    const XFER_FEE = 10n;

    // when
    const results = calculateOptions({
      entryPriceCents: ENTRY_CENTS,
      strikeBps: STRIKE_BPS_5PCT,
      optionSizeSats: Q_SATS,
      premiumBps: PREMIUM_BPS_1PCT,
      settlementPriceCents: SETTLEMENT_BELOW_STRIKE_CENTS,
      premiumFeeBps: FEE_BPS,
      profitFeeBps: PROFIT_BPS,
      ckbtcTransferFeeSats: XFER_FEE,
    });

    // then
    expect(results.isInTheMoney).toBe(false);
    expect(results.profitCents).toBe(0n);
    expect(results.grossBuyerPayoutSats).toBe(0n);
    expect(results.writerReturnedSats).toBe(Q_SATS);
  });

  test("should handle zero option size", () => {
    // given
    const ENTRY_CENTS = 7951400n;
    const STRIKE_BPS = 300n;
    const ZERO_Q = 0n;
    const PREMIUM_BPS = 100n;
    const SETTLEMENT_CENTS = 10000000n;
    const FEE_BPS = 500n;
    const PROFIT_BPS = 2000n;
    const XFER_FEE = 10n;

    // when
    const results = calculateOptions({
      entryPriceCents: ENTRY_CENTS,
      strikeBps: STRIKE_BPS,
      optionSizeSats: ZERO_Q,
      premiumBps: PREMIUM_BPS,
      settlementPriceCents: SETTLEMENT_CENTS,
      premiumFeeBps: FEE_BPS,
      profitFeeBps: PROFIT_BPS,
      ckbtcTransferFeeSats: XFER_FEE,
    });

    // then
    expect(results.grossPremiumSats).toBe(0n);
    expect(results.premiumFeeSats).toBe(0n);
    expect(results.writerPremiumSats).toBe(0n);
    expect(results.grossBuyerPayoutSats).toBe(0n);
    expect(results.buyerNetSats).toBe(0n);
    expect(results.writerReturnedSats).toBe(0n);
  });
});

import { describe, expect, test } from "vitest";

import { calculatePnl, calculatePnlPercent, getMoneyStatus, getTradeResult } from "./pnl";

describe("calculatePnl", () => {
  const PREMIUM_SATS = BigInt(50_000);
  const QUANTITY_SATS = BigInt(200_000);

  test("should return positive PnL for buyer when payout exceeds premium", () => {
    // given
    const PAYOUT_SATS = BigInt(80_000);

    // when
    const result = calculatePnl("buyer", PREMIUM_SATS, PAYOUT_SATS, QUANTITY_SATS);

    // then
    const EXPECTED_PNL = BigInt(30_000);
    expect(result).toBe(EXPECTED_PNL);
  });

  test("should return negative PnL for buyer when payout is less than premium", () => {
    // given
    const PAYOUT_SATS = BigInt(20_000);

    // when
    const result = calculatePnl("buyer", PREMIUM_SATS, PAYOUT_SATS, QUANTITY_SATS);

    // then
    const EXPECTED_PNL = BigInt(-30_000);
    expect(result).toBe(EXPECTED_PNL);
  });

  test("should return zero PnL for buyer when payout equals premium", () => {
    // given
    const PAYOUT_SATS = PREMIUM_SATS;

    // when
    const result = calculatePnl("buyer", PREMIUM_SATS, PAYOUT_SATS, QUANTITY_SATS);

    // then
    const EXPECTED_PNL = BigInt(0);
    expect(result).toBe(EXPECTED_PNL);
  });

  test("should return positive PnL for writer when collateral is fully returned", () => {
    // given
    const PAYOUT_SATS = QUANTITY_SATS;

    // when
    const result = calculatePnl("writer", PREMIUM_SATS, PAYOUT_SATS, QUANTITY_SATS);

    // then
    const EXPECTED_PNL = PREMIUM_SATS;
    expect(result).toBe(EXPECTED_PNL);
  });

  test("should return negative PnL for writer when buyer payout exceeds premium", () => {
    // given
    const PAYOUT_SATS = BigInt(120_000);

    // when
    const result = calculatePnl("writer", PREMIUM_SATS, PAYOUT_SATS, QUANTITY_SATS);

    // then
    const EXPECTED_PNL = BigInt(-30_000);
    expect(result).toBe(EXPECTED_PNL);
  });

  test("should return zero PnL for writer when premium offsets buyer payout", () => {
    // given
    const PAYOUT_SATS = BigInt(150_000);

    // when
    const result = calculatePnl("writer", PREMIUM_SATS, PAYOUT_SATS, QUANTITY_SATS);

    // then
    const EXPECTED_PNL = BigInt(0);
    expect(result).toBe(EXPECTED_PNL);
  });
});

describe("calculatePnlPercent", () => {
  const PREMIUM_SATS = BigInt(50_000);
  const QUANTITY_SATS = BigInt(200_000);

  test("should return positive percentage for buyer with positive PnL", () => {
    // given
    const PNL_SATS = BigInt(25_000);

    // when
    const result = calculatePnlPercent("buyer", PNL_SATS, PREMIUM_SATS, QUANTITY_SATS);

    // then
    const EXPECTED_PERCENT = 50;
    expect(result).toBe(EXPECTED_PERCENT);
  });

  test("should return negative percentage for buyer with negative PnL", () => {
    // given
    const PNL_SATS = BigInt(-30_000);

    // when
    const result = calculatePnlPercent("buyer", PNL_SATS, PREMIUM_SATS, QUANTITY_SATS);

    // then
    const EXPECTED_PERCENT = -60;
    expect(result).toBe(EXPECTED_PERCENT);
  });

  test("should return zero for buyer when premium is zero", () => {
    // given
    const ZERO_PREMIUM = BigInt(0);
    const PNL_SATS = BigInt(10_000);

    // when
    const result = calculatePnlPercent("buyer", PNL_SATS, ZERO_PREMIUM, QUANTITY_SATS);

    // then
    const EXPECTED_PERCENT = 0;
    expect(result).toBe(EXPECTED_PERCENT);
  });

  test("should return positive percentage for writer with positive PnL", () => {
    // given
    const PNL_SATS = BigInt(40_000);

    // when
    const result = calculatePnlPercent("writer", PNL_SATS, PREMIUM_SATS, QUANTITY_SATS);

    // then
    const EXPECTED_PERCENT = 20;
    expect(result).toBe(EXPECTED_PERCENT);
  });

  test("should return negative percentage for writer with negative PnL", () => {
    // given
    const PNL_SATS = BigInt(-100_000);

    // when
    const result = calculatePnlPercent("writer", PNL_SATS, PREMIUM_SATS, QUANTITY_SATS);

    // then
    const EXPECTED_PERCENT = -50;
    expect(result).toBe(EXPECTED_PERCENT);
  });

  test("should return zero for writer when quantity is zero", () => {
    // given
    const ZERO_QUANTITY = BigInt(0);
    const PNL_SATS = BigInt(10_000);

    // when
    const result = calculatePnlPercent("writer", PNL_SATS, PREMIUM_SATS, ZERO_QUANTITY);

    // then
    const EXPECTED_PERCENT = 0;
    expect(result).toBe(EXPECTED_PERCENT);
  });
});

describe("getTradeResult", () => {
  test("should return profit for positive PnL", () => {
    // given
    const PNL_SATS = BigInt(10_000);

    // when
    const result = getTradeResult(PNL_SATS);

    // then
    expect(result).toBe("profit");
  });

  test("should return loss for negative PnL", () => {
    // given
    const PNL_SATS = BigInt(-10_000);

    // when
    const result = getTradeResult(PNL_SATS);

    // then
    expect(result).toBe("loss");
  });

  test("should return breakeven for zero PnL", () => {
    // given
    const PNL_SATS = BigInt(0);

    // when
    const result = getTradeResult(PNL_SATS);

    // then
    expect(result).toBe("breakeven");
  });
});

describe("getMoneyStatus", () => {
  const STRIKE_PRICE_CENTS = BigInt(10_000);

  test("should return itm when settlement is much higher than strike", () => {
    // given
    const SETTLEMENT_PRICE_CENTS = BigInt(12_000);

    // when
    const result = getMoneyStatus(STRIKE_PRICE_CENTS, SETTLEMENT_PRICE_CENTS);

    // then
    expect(result).toBe("itm");
  });

  test("should return otm when settlement is much lower than strike", () => {
    // given
    const SETTLEMENT_PRICE_CENTS = BigInt(8_000);

    // when
    const result = getMoneyStatus(STRIKE_PRICE_CENTS, SETTLEMENT_PRICE_CENTS);

    // then
    expect(result).toBe("otm");
  });

  test("should return atm when settlement is within 1% of strike", () => {
    // given
    const SETTLEMENT_PRICE_CENTS = BigInt(10_050);

    // when
    const result = getMoneyStatus(STRIKE_PRICE_CENTS, SETTLEMENT_PRICE_CENTS);

    // then
    expect(result).toBe("atm");
  });

  test("should not return atm when diff is exactly at threshold boundary", () => {
    // given
    const THRESHOLD_CENTS = BigInt(100);
    const SETTLEMENT_PRICE_CENTS = STRIKE_PRICE_CENTS + THRESHOLD_CENTS;

    // when
    const result = getMoneyStatus(STRIKE_PRICE_CENTS, SETTLEMENT_PRICE_CENTS);

    // then
    expect(result).not.toBe("atm");
    expect(result).toBe("itm");
  });
});

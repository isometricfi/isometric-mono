import { describe, expect, test } from "vitest";
import {
  basisPointsToPercent,
  btcToSats,
  formatBtc,
  formatBtcBigint,
  formatBtcWithSymbol,
  formatBtcWithSymbolBigint,
  nsToISOString,
  parseBtcToSats,
  parseBtcToSatsBigint,
  roundToN,
  SATS_PER_BTC,
  satsToBtc,
  secondsToDays,
} from "./utils";

describe("satsToBtc", () => {
  test("should return 1 BTC for 100_000_000 sats", () => {
    // given
    const sats = SATS_PER_BTC;

    // when
    const result = satsToBtc(sats);

    // then
    expect(result).toBe(1);
  });

  test("should return 0.5 BTC for 50_000_000 sats", () => {
    // given
    const sats = 50_000_000;

    // when
    const result = satsToBtc(sats);

    // then
    expect(result).toBe(0.5);
  });

  test("should return 0 for zero sats", () => {
    // given
    const sats = 0;

    // when
    const result = satsToBtc(sats);

    // then
    expect(result).toBe(0);
  });
});

describe("btcToSats", () => {
  test("should return 100_000_000 sats for 1 BTC", () => {
    // given
    const btc = 1;

    // when
    const result = btcToSats(btc);

    // then
    expect(result).toBe(SATS_PER_BTC);
  });

  test("should round to nearest sat for sub-satoshi BTC values", () => {
    // given
    const btc = 0.000000016;

    // when
    const result = btcToSats(btc);

    // then
    expect(result).toBe(2);
  });
});

describe("formatBtc", () => {
  test("should format 100_000_000 sats as '1'", () => {
    // given
    const sats = SATS_PER_BTC;

    // when
    const result = formatBtc(sats);

    // then
    expect(result).toBe("1");
  });

  test("should strip trailing zeros from formatted output", () => {
    // given
    const sats = 10_000_000;

    // when
    const result = formatBtc(sats);

    // then
    expect(result).toBe("0.1");
  });

  test("should truncate to maxDecimals when specified", () => {
    // given
    const sats = 12_345_678;

    // when
    const result = formatBtc(sats, 2);

    // then
    expect(result).toBe("0.12");
  });
});

describe("formatBtcWithSymbol", () => {
  test("should prepend the BTC symbol to formatted value", () => {
    // given
    const sats = SATS_PER_BTC;

    // when
    const result = formatBtcWithSymbol(sats);

    // then
    expect(result).toBe("₿1");
  });
});

describe("parseBtcToSats", () => {
  test("should parse dynamic labs wallet getbalance btc strings without treating them as sats", () => {
    // given
    const dynamicGetBalanceBtcString = "0.0015";

    // when
    const parsedAsSats = parseBtcToSats(dynamicGetBalanceBtcString);
    const mistakenNumberCoercion = Math.floor(Number(dynamicGetBalanceBtcString));

    // then
    expect(mistakenNumberCoercion).toBe(0);
    expect(parsedAsSats).toBe(150_000);
  });

  test("should parse '1.5' to 150_000_000 sats", () => {
    // given
    const input = "1.5";

    // when
    const result = parseBtcToSats(input);

    // then
    expect(result).toBe(150_000_000);
  });

  test("should return 0 for non-numeric input", () => {
    // given
    const input = "abc";

    // when
    const result = parseBtcToSats(input);

    // then
    expect(result).toBe(0);
  });
});

describe("formatBtcBigint", () => {
  test("should format 100_000_000n sats as '1'", () => {
    // given
    const sats = BigInt(SATS_PER_BTC);

    // when
    const result = formatBtcBigint(sats);

    // then
    expect(result).toBe("1");
  });

  test("should preserve all significant decimals", () => {
    // given
    const sats = BigInt(12_345_678);

    // when
    const result = formatBtcBigint(sats);

    // then
    expect(result).toBe("0.12345678");
  });

  test("should prefix negative values with a minus sign", () => {
    // given
    const sats = BigInt(-50_000_000);

    // when
    const result = formatBtcBigint(sats);

    // then
    expect(result).toBe("-0.5");
  });

  test("should return whole number only when maxDecimals is 0", () => {
    // given
    const sats = BigInt(150_000_000);

    // when
    const result = formatBtcBigint(sats, 0);

    // then
    expect(result).toBe("1");
  });
});

describe("formatBtcWithSymbolBigint", () => {
  test("should prepend BTC symbol for positive values", () => {
    // given
    const sats = BigInt(SATS_PER_BTC);

    // when
    const result = formatBtcWithSymbolBigint(sats);

    // then
    expect(result).toBe("₿1");
  });

  test("should prepend minus and BTC symbol for negative values", () => {
    // given
    const sats = BigInt(-SATS_PER_BTC);

    // when
    const result = formatBtcWithSymbolBigint(sats);

    // then
    expect(result).toBe("-₿1");
  });
});

describe("parseBtcToSatsBigint", () => {
  test("should parse '1' to 100_000_000n sats", () => {
    // given
    const input = "1";

    // when
    const result = parseBtcToSatsBigint(input);

    // then
    expect(result).toBe(BigInt(SATS_PER_BTC));
  });

  test("should parse '0.5' to 50_000_000n sats", () => {
    // given
    const input = "0.5";

    // when
    const result = parseBtcToSatsBigint(input);

    // then
    expect(result).toBe(BigInt(50_000_000));
  });

  test("should return 0n for empty string", () => {
    // given
    const input = "";

    // when
    const result = parseBtcToSatsBigint(input);

    // then
    expect(result).toBe(BigInt(0));
  });

  test("should return 0n for non-numeric input", () => {
    // given
    const input = "abc";

    // when
    const result = parseBtcToSatsBigint(input);

    // then
    expect(result).toBe(BigInt(0));
  });
});

describe("roundToN", () => {
  test("should round to 2 decimal places by default", () => {
    // given
    const value = 1.2345;

    // when
    const result = roundToN(value);

    // then
    expect(result).toBe(1.23);
  });

  test("should round to the specified number of decimal places", () => {
    // given
    const value = 1.2345;

    // when
    const result = roundToN(value, 3);

    // then
    expect(result).toBe(1.235);
  });
});

describe("secondsToDays", () => {
  test("should return 1 for exactly 86400 seconds", () => {
    // given
    const oneDay = BigInt(86400);

    // when
    const result = secondsToDays(oneDay);

    // then
    expect(result).toBe(1);
  });

  test("should clamp to 1 for sub-day durations", () => {
    // given
    const halfDay = BigInt(43200);

    // when
    const result = secondsToDays(halfDay);

    // then
    expect(result).toBe(1);
  });

  test("should round 3.5 days to 4", () => {
    // given
    const threeDaysAndHalf = BigInt(86400 * 3 + 43200);

    // when
    const result = secondsToDays(threeDaysAndHalf);

    // then
    expect(result).toBe(4);
  });
});

describe("nsToISOString", () => {
  test("should convert nanosecond timestamp to valid ISO string", () => {
    // given
    const ns = BigInt(1_700_000_000_000_000_000);

    // when
    const result = nsToISOString(ns);

    // then
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });
});

describe("basisPointsToPercent", () => {
  test("should convert 100 basis points to 1%", () => {
    // given
    const basisPoints = 100;

    // when
    const result = basisPointsToPercent(basisPoints);

    // then
    expect(result).toBe(1);
  });

  test("should convert 250 basis points to 2.5%", () => {
    // given
    const basisPoints = 250;

    // when
    const result = basisPointsToPercent(basisPoints);

    // then
    expect(result).toBe(2.5);
  });

  test("should convert 0 basis points to 0%", () => {
    // given
    const basisPoints = 0;

    // when
    const result = basisPointsToPercent(basisPoints);

    // then
    expect(result).toBe(0);
  });
});

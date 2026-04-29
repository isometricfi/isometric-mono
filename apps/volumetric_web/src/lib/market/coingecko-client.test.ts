import { describe, expect, test, vi } from "vitest";
import { fetchBtcHistoryQuotes, fetchCurrentBtcPriceQuote } from "./coingecko-client";

vi.mock("server-only", () => ({}));

describe("fetchCurrentBtcPriceQuote", () => {
  test("should parse a valid Bitcoin USD quote", async () => {
    // given
    const PRICE_USD = 62_345.12;
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        bitcoin: {
          usd: PRICE_USD,
        },
      }),
    });

    // when
    const quote = await fetchCurrentBtcPriceQuote(fetchMock as unknown as typeof fetch);

    // then
    expect(quote).toEqual({
      priceUsd: PRICE_USD,
      source: "coingecko",
    });
  });

  test("should reject a malformed quote", async () => {
    // given
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        bitcoin: {
          usd: 0,
        },
      }),
    });

    // when
    const result = fetchCurrentBtcPriceQuote(fetchMock as unknown as typeof fetch);

    // then
    await expect(result).rejects.toThrow();
  });
});

describe("fetchBtcHistoryQuotes", () => {
  test("should parse valid Bitcoin USD history points", async () => {
    // given
    const DAYS = 7;
    const TIMESTAMP_MS = 1_700_000_000_000;
    const PRICE_USD = 61_111.25;
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        prices: [[TIMESTAMP_MS, PRICE_USD]],
      }),
    });

    // when
    const quotes = await fetchBtcHistoryQuotes(DAYS, fetchMock as unknown as typeof fetch);

    // then
    expect(quotes).toEqual([
      {
        timestampMs: TIMESTAMP_MS,
        priceUsd: PRICE_USD,
        source: "coingecko",
      },
    ]);
  });

  test("should reject malformed history points", async () => {
    // given
    const DAYS = 7;
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        prices: [[0, 61_111.25]],
      }),
    });

    // when
    const result = fetchBtcHistoryQuotes(DAYS, fetchMock as unknown as typeof fetch);

    // then
    await expect(result).rejects.toThrow();
  });
});

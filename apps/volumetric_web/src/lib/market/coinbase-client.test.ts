import { describe, expect, test, vi } from "vitest";
import { fetchBtcHistoryQuotes, fetchCurrentBtcPriceQuote } from "./coinbase-client";

vi.mock("server-only", () => ({}));

describe("fetchCurrentBtcPriceQuote", () => {
  test("should bypass fetch cache for Coinbase requests", async () => {
    // given
    const PRICE_USD = 62_345.12;
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        price: String(PRICE_USD),
      }),
    });

    // when
    await fetchCurrentBtcPriceQuote(fetchMock as unknown as typeof fetch);

    // then
    const EXPECTED_REQUEST_CACHE = "no-store";
    expect(fetchMock).toHaveBeenCalledWith(
      expect.any(URL),
      expect.objectContaining({
        cache: EXPECTED_REQUEST_CACHE,
        headers: expect.objectContaining({
          Accept: "application/json",
          "User-Agent": "volumetric-web/1.0 (btc-market-sync)",
        }),
      }),
    );
  });

  test("should parse a valid Bitcoin USD quote", async () => {
    // given
    const PRICE_USD = 62_345.12;
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        price: String(PRICE_USD),
      }),
    });

    // when
    const quote = await fetchCurrentBtcPriceQuote(fetchMock as unknown as typeof fetch);

    // then
    expect(quote).toEqual({
      priceUsd: PRICE_USD,
      source: "coinbase_exchange",
    });
  });

  test("should reject a malformed quote", async () => {
    // given
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        price: "0",
      }),
    });

    // when
    const result = fetchCurrentBtcPriceQuote(fetchMock as unknown as typeof fetch);

    // then
    await expect(result).rejects.toThrow();
  });
});

describe("fetchBtcHistoryQuotes", () => {
  test("should parse valid Bitcoin USD candle closes", async () => {
    // given
    const DAYS_WITHIN_SINGLE_WINDOW = 7;
    const OLDER_TIMESTAMP_SECONDS = 1_700_000_000;
    const NEWER_TIMESTAMP_SECONDS = 1_700_003_600;
    const OLDER_CLOSE_PRICE_USD = 61_111.25;
    const NEWER_CLOSE_PRICE_USD = 62_222.5;
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue([
        [NEWER_TIMESTAMP_SECONDS, 61_000, 63_000, 61_500, NEWER_CLOSE_PRICE_USD, 10],
        [OLDER_TIMESTAMP_SECONDS, 60_000, 62_000, 60_500, OLDER_CLOSE_PRICE_USD, 8],
      ]),
    });

    // when
    const quotes = await fetchBtcHistoryQuotes(
      DAYS_WITHIN_SINGLE_WINDOW,
      fetchMock as unknown as typeof fetch,
    );

    // then
    expect(quotes).toEqual([
      {
        timestampMs: OLDER_TIMESTAMP_SECONDS * 1_000,
        priceUsd: OLDER_CLOSE_PRICE_USD,
        source: "coinbase_exchange",
      },
      {
        timestampMs: NEWER_TIMESTAMP_SECONDS * 1_000,
        priceUsd: NEWER_CLOSE_PRICE_USD,
        source: "coinbase_exchange",
      },
    ]);
  });

  test("should paginate history fetches into multiple windows for long ranges", async () => {
    // given
    const DAYS_REQUIRING_MULTIPLE_WINDOWS = 30;
    const FIRST_WINDOW_TIMESTAMP_SECONDS = 1_700_000_000;
    const SECOND_WINDOW_TIMESTAMP_SECONDS = 1_700_900_000;
    const THIRD_WINDOW_TIMESTAMP_SECONDS = 1_701_800_000;
    const FIRST_WINDOW_CLOSE_PRICE_USD = 60_000;
    const SECOND_WINDOW_CLOSE_PRICE_USD = 61_000;
    const THIRD_WINDOW_CLOSE_PRICE_USD = 62_000;
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: vi
          .fn()
          .mockResolvedValue([
            [
              FIRST_WINDOW_TIMESTAMP_SECONDS,
              59_000,
              61_000,
              59_500,
              FIRST_WINDOW_CLOSE_PRICE_USD,
              5,
            ],
          ]),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: vi
          .fn()
          .mockResolvedValue([
            [
              SECOND_WINDOW_TIMESTAMP_SECONDS,
              60_000,
              62_000,
              60_500,
              SECOND_WINDOW_CLOSE_PRICE_USD,
              5,
            ],
          ]),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: vi
          .fn()
          .mockResolvedValue([
            [
              THIRD_WINDOW_TIMESTAMP_SECONDS,
              61_000,
              63_000,
              61_500,
              THIRD_WINDOW_CLOSE_PRICE_USD,
              5,
            ],
          ]),
      });

    // when
    const quotes = await fetchBtcHistoryQuotes(
      DAYS_REQUIRING_MULTIPLE_WINDOWS,
      fetchMock as unknown as typeof fetch,
    );

    // then
    const EXPECTED_WINDOW_COUNT = 3;
    expect(fetchMock).toHaveBeenCalledTimes(EXPECTED_WINDOW_COUNT);
    expect(quotes.map((quote) => quote.priceUsd)).toEqual([
      FIRST_WINDOW_CLOSE_PRICE_USD,
      SECOND_WINDOW_CLOSE_PRICE_USD,
      THIRD_WINDOW_CLOSE_PRICE_USD,
    ]);
  });

  test("should reject malformed history points", async () => {
    // given
    const DAYS_WITHIN_SINGLE_WINDOW = 7;
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue([[0, 61_111.25]]),
    });

    // when
    const result = fetchBtcHistoryQuotes(
      DAYS_WITHIN_SINGLE_WINDOW,
      fetchMock as unknown as typeof fetch,
    );

    // then
    await expect(result).rejects.toThrow();
  });
});

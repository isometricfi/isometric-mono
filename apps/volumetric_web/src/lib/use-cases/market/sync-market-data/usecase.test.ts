import { describe, expect, test, vi } from "vitest";
import type { IMarketDataRepository } from "@/lib/repositories/market/market-data-repository.interface";
import { shouldRefreshBtcHistory, syncBtcMarketData } from "./usecase";

vi.mock("server-only", () => ({}));

function createRepositoryMock(latestHistoryUpdatedAtMs: number | null): IMarketDataRepository {
  return {
    saveCurrentBtcPrice: vi.fn(),
    saveBtcHistoryPoints: vi.fn(),
    getCurrentBtcPrice: vi.fn(),
    getBtcHistoryPointsSince: vi.fn(),
    getLatestBtcHistoryUpdatedAtMs: vi.fn().mockResolvedValue(latestHistoryUpdatedAtMs),
  };
}

describe("syncBtcMarketData", () => {
  test("should update current price and refresh stale history", async () => {
    // given
    const NOW_MS = 1_700_000_000_000;
    const PRICE_USD = 62_345.12;
    const HISTORY_TIMESTAMP_MS = 1_699_999_000_000;
    const HISTORY_PRICE_USD = 61_000;
    const repository = createRepositoryMock(null);
    const fetchCurrentPriceQuote = vi.fn().mockResolvedValue({
      priceUsd: PRICE_USD,
      source: "coingecko",
    });
    const fetchHistoryQuotes = vi.fn().mockResolvedValue([
      {
        timestampMs: HISTORY_TIMESTAMP_MS,
        priceUsd: HISTORY_PRICE_USD,
        source: "coingecko",
      },
    ]);

    // when
    const result = await syncBtcMarketData({
      repository,
      fetchCurrentPriceQuote,
      fetchHistoryQuotes,
      nowMs: () => NOW_MS,
    });

    // then
    expect(repository.saveCurrentBtcPrice).toHaveBeenCalledWith({
      priceUsd: PRICE_USD,
      source: "coingecko",
      updatedAtMs: NOW_MS,
    });
    expect(fetchHistoryQuotes).toHaveBeenCalledWith(30);
    expect(repository.saveBtcHistoryPoints).toHaveBeenCalledWith([
      {
        timestampMs: HISTORY_TIMESTAMP_MS,
        priceUsd: HISTORY_PRICE_USD,
        source: "coingecko",
        updatedAtMs: NOW_MS,
      },
    ]);
    expect(result).toEqual({
      success: true,
      currentPriceUpdated: true,
      historyRefreshed: true,
      historyPointsSaved: 1,
    });
  });

  test("should skip history refresh while cached history is fresh", async () => {
    // given
    const NOW_MS = 1_700_000_000_000;
    const FRESH_HISTORY_UPDATED_AT_MS = NOW_MS - 60_000;
    const PRICE_USD = 62_345.12;
    const repository = createRepositoryMock(FRESH_HISTORY_UPDATED_AT_MS);
    const fetchCurrentPriceQuote = vi.fn().mockResolvedValue({
      priceUsd: PRICE_USD,
      source: "coingecko",
    });
    const fetchHistoryQuotes = vi.fn();

    // when
    const result = await syncBtcMarketData({
      repository,
      fetchCurrentPriceQuote,
      fetchHistoryQuotes,
      nowMs: () => NOW_MS,
    });

    // then
    expect(fetchHistoryQuotes).not.toHaveBeenCalled();
    expect(repository.saveBtcHistoryPoints).not.toHaveBeenCalled();
    expect(result).toEqual({
      success: true,
      currentPriceUpdated: true,
      historyRefreshed: false,
      historyPointsSaved: 0,
    });
  });
});

describe("shouldRefreshBtcHistory", () => {
  test("should refresh when history has never been cached", () => {
    // given
    const NOW_MS = 1_700_000_000_000;

    // when
    const shouldRefresh = shouldRefreshBtcHistory(null, NOW_MS);

    // then
    expect(shouldRefresh).toBe(true);
  });
});

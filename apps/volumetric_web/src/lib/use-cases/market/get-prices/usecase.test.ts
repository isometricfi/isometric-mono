import { describe, expect, test, vi } from "vitest";
import type { IMarketDataRepository } from "@/lib/repositories/market/market-data-repository.interface";
import { getMarketPrices } from "./usecase";

vi.mock("server-only", () => ({}));

function createRepositoryMock(
  currentPrice: Awaited<ReturnType<IMarketDataRepository["getCurrentBtcPrice"]>>,
): IMarketDataRepository {
  return {
    saveCurrentBtcPrice: vi.fn(),
    saveBtcHistoryPoints: vi.fn(),
    getCurrentBtcPrice: vi.fn().mockResolvedValue(currentPrice),
    getBtcHistoryPointsSince: vi.fn(),
    getLatestBtcHistoryUpdatedAtMs: vi.fn(),
  };
}

describe("getMarketPrices", () => {
  test("should return the cached Bitcoin price", async () => {
    // given
    const PRICE_USD = 62_345.12;
    const UPDATED_AT_MS = 1_700_000_000_000;
    const repository = createRepositoryMock({
      priceUsd: PRICE_USD,
      updatedAtMs: UPDATED_AT_MS,
    });

    // when
    const prices = await getMarketPrices(repository);

    // then
    expect(prices).toEqual({
      btc: PRICE_USD,
      updatedAtMs: UPDATED_AT_MS,
    });
  });

  test("should return null price fields when the cache is empty", async () => {
    // given
    const repository = createRepositoryMock(null);

    // when
    const prices = await getMarketPrices(repository);

    // then
    expect(prices).toEqual({
      btc: null,
      updatedAtMs: null,
    });
  });
});

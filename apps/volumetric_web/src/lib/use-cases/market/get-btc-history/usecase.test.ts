import { describe, expect, test, vi } from "vitest";
import type { IMarketDataRepository } from "@/lib/repositories/market/market-data-repository.interface";
import { inputSchema } from "./schema";
import { getBtcHistory } from "./usecase";

vi.mock("server-only", () => ({}));

function createRepositoryMock(
  historyPoints: Awaited<ReturnType<IMarketDataRepository["getBtcHistoryPointsSince"]>>,
): IMarketDataRepository {
  return {
    saveCurrentBtcPrice: vi.fn(),
    saveBtcHistoryPoints: vi.fn(),
    getCurrentBtcPrice: vi.fn(),
    getBtcHistoryPointsSince: vi.fn().mockResolvedValue(historyPoints),
    getLatestBtcHistoryUpdatedAtMs: vi.fn(),
  };
}

describe("getBtcHistory", () => {
  test("should return cached history points inside the requested day range", async () => {
    // given
    const NOW_MS = 1_700_086_400_000;
    const DAYS = 1;
    const TIMESTAMP_MS = 1_700_000_000_000;
    const PRICE_USD = 62_000;
    const repository = createRepositoryMock([{ timestampMs: TIMESTAMP_MS, priceUsd: PRICE_USD }]);

    // when
    const history = await getBtcHistory({ days: DAYS }, repository, NOW_MS);

    // then
    expect(repository.getBtcHistoryPointsSince).toHaveBeenCalledWith(TIMESTAMP_MS);
    expect(history).toEqual([{ timestamp: TIMESTAMP_MS, price: PRICE_USD }]);
  });

  test("should reject history windows above the supported maximum", () => {
    // given
    const DAYS_ABOVE_MAXIMUM = 31;

    // when
    const result = inputSchema.safeParse({ days: DAYS_ABOVE_MAXIMUM });

    // then
    expect(result.success).toBe(false);
  });
});

import type { _SERVICE, StoredXrcBtcUsdRate } from "@volumetric/canister-types";
import { describe, expect, test, vi } from "vitest";
import { getMarketPrices } from "./usecase";

vi.mock("server-only", () => ({}));

const TEST_DECIMALS = 9;

function createActorMock(latestRate: StoredXrcBtcUsdRate | null): _SERVICE {
  return {
    get_latest_xrc_btc_usd_rate: vi.fn().mockResolvedValue(latestRate ? [latestRate] : []),
  } as unknown as _SERVICE;
}

function createStoredXrcBtcUsdRate(overrides: Partial<StoredXrcBtcUsdRate>): StoredXrcBtcUsdRate {
  return {
    xrc_timestamp_seconds: 1_700_000_000n,
    fetched_at_seconds: 1_700_000_000n,
    price_cents: 6_234_512n,
    decimals: TEST_DECIMALS,
    ...overrides,
  };
}

describe("getMarketPrices", () => {
  test("should return the latest canister-cached XRC Bitcoin price", async () => {
    // given
    const PRICE_USD = 62_345.12;
    const UPDATED_AT_MS = 1_700_000_000_000;
    const actor = createActorMock(createStoredXrcBtcUsdRate({}));

    // when
    const prices = await getMarketPrices({
      getActor: vi.fn().mockResolvedValue(actor),
    });

    // then
    expect(prices).toEqual({
      btc: PRICE_USD,
      updatedAtMs: UPDATED_AT_MS,
    });
  });

  test("should return null price fields when the canister XRC cache is empty", async () => {
    // given
    const actor = createActorMock(null);

    // when
    const prices = await getMarketPrices({
      getActor: vi.fn().mockResolvedValue(actor),
    });

    // then
    expect(prices).toEqual({
      btc: null,
      updatedAtMs: null,
    });
  });
});

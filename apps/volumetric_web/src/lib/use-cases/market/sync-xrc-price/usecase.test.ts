import type { _SERVICE, StoredXrcBtcUsdRate } from "@volumetric/canister-types";
import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("server-only", () => ({}));

import type { IXrcSnapshotRepository } from "@/lib/repositories/xrc-snapshot/xrc-snapshot-repository.interface";
import { syncXrcPriceFromCanister } from "./usecase";

const { getCanisterActorMock } = vi.hoisted(() => ({
  getCanisterActorMock: vi.fn(),
}));

vi.mock("@/lib/canister-server", () => ({
  getCanisterActor: getCanisterActorMock,
}));

function createStoredRate(overrides: Partial<StoredXrcBtcUsdRate> = {}): StoredXrcBtcUsdRate {
  return {
    decimals: 9,
    forex_timestamp: [],
    rate: 50_000_000_000_000n,
    price_cents: 5_000_000n,
    quote_asset_num_received_rates: 1n,
    xrc_timestamp_seconds: 1_700_000_000n,
    base_asset_num_received_rates: 1n,
    base_asset_num_queried_sources: 1n,
    standard_deviation: 0n,
    quote_asset_num_queried_sources: 1n,
    fetched_at_seconds: 1_700_000_100n,
    ...overrides,
  };
}

describe("syncXrcPriceFromCanister", () => {
  const insertSnapshot = vi.fn();
  const getLatestSnapshotResponseJson = vi.fn();

  const repository: IXrcSnapshotRepository = {
    insertSnapshot,
    getLatestSnapshotResponseJson,
  };

  beforeEach(() => {
    insertSnapshot.mockReset();
    getLatestSnapshotResponseJson.mockReset();
    getCanisterActorMock.mockReset();
  });

  test("should insert a row when the canister returns a rate and the DB has no matching XRC timestamp", async () => {
    // given
    const rate = createStoredRate();
    const actor = {
      get_latest_xrc_btc_usd_rate: vi.fn().mockResolvedValue([rate]),
    } as unknown as _SERVICE;
    getCanisterActorMock.mockResolvedValue(actor);
    getLatestSnapshotResponseJson.mockResolvedValue(null);

    // when
    const result = await syncXrcPriceFromCanister({ repository });

    // then
    expect(result).toEqual({ success: true, inserted: true });
    expect(insertSnapshot).toHaveBeenCalledTimes(1);
    expect(insertSnapshot.mock.calls[0][0].fetchedAtMs).toBe(1_700_000_100_000);
    const parsed: { source: string; xrc_timestamp_seconds: number } = JSON.parse(
      insertSnapshot.mock.calls[0][0].responseJson,
    );
    expect(parsed.source).toBe("canister_stable_cache");
    expect(parsed.xrc_timestamp_seconds).toBe(1_700_000_000);
  });

  test("should skip insert when the canister cache is empty", async () => {
    // given
    const actor = {
      get_latest_xrc_btc_usd_rate: vi.fn().mockResolvedValue([]),
    } as unknown as _SERVICE;
    getCanisterActorMock.mockResolvedValue(actor);

    // when
    const result = await syncXrcPriceFromCanister({ repository });

    // then
    expect(result).toEqual({
      success: true,
      inserted: false,
      skippedReason: "empty_canister_cache",
    });
    expect(insertSnapshot).not.toHaveBeenCalled();
  });

  test("should skip insert when the latest DB row already matches the XRC timestamp", async () => {
    // given
    const rate = createStoredRate({ xrc_timestamp_seconds: 1_700_000_000n });
    const actor = {
      get_latest_xrc_btc_usd_rate: vi.fn().mockResolvedValue([rate]),
    } as unknown as _SERVICE;
    getCanisterActorMock.mockResolvedValue(actor);
    getLatestSnapshotResponseJson.mockResolvedValue(
      JSON.stringify({
        source: "canister_stable_cache",
        xrc_timestamp_seconds: 1_700_000_000,
      }),
    );

    // when
    const result = await syncXrcPriceFromCanister({ repository });

    // then
    expect(result).toEqual({
      success: true,
      inserted: false,
      skippedReason: "duplicate_xrc_timestamp",
    });
    expect(insertSnapshot).not.toHaveBeenCalled();
  });
});

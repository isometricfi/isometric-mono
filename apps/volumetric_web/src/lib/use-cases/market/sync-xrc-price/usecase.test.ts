import type { _SERVICE, StoredXrcBtcUsdRate } from "@volumetric/canister-types";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("server-only", () => ({}));

import type { IXrcSnapshotRepository } from "@/lib/repositories/xrc-snapshot/xrc-snapshot-repository.interface";
import { syncXrcPriceFromCanister } from "./usecase";

const { getCanisterActorMock, logErrorMock } = vi.hoisted(() => ({
  getCanisterActorMock: vi.fn(),
  logErrorMock: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/canister-server", () => ({
  getCanisterActor: getCanisterActorMock,
}));

vi.mock("@/lib/telemetry/logs", () => ({
  logError: logErrorMock,
}));

function createStoredRate(overrides: Partial<StoredXrcBtcUsdRate> = {}): StoredXrcBtcUsdRate {
  return {
    xrc_timestamp_seconds: 1_700_000_000n,
    fetched_at_seconds: 1_700_000_100n,
    price_cents: 5_000_000n,
    decimals: 9,
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
    logErrorMock.mockClear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
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

  test("should log an error when the canister cache is older than 30 minutes", async () => {
    // given
    const NOW_MS = 1_700_002_000_000;
    const STALE_XRC_TIMESTAMP_SECONDS = 1_700_000_000n;
    vi.setSystemTime(new Date(NOW_MS));
    const rate = createStoredRate({ xrc_timestamp_seconds: STALE_XRC_TIMESTAMP_SECONDS });
    const actor = {
      get_latest_xrc_btc_usd_rate: vi.fn().mockResolvedValue([rate]),
    } as unknown as _SERVICE;
    getCanisterActorMock.mockResolvedValue(actor);
    getLatestSnapshotResponseJson.mockResolvedValue(null);

    // when
    await syncXrcPriceFromCanister({ repository });

    // then
    expect(logErrorMock).toHaveBeenCalledTimes(1);
    expect(logErrorMock.mock.calls[0][0]).toContain("Canister XRC cache stale");
  });

  test("should not log an error when the canister cache is within 30 minutes", async () => {
    // given
    const NOW_MS = 1_700_000_500_000;
    const FRESH_XRC_TIMESTAMP_SECONDS = 1_700_000_000n;
    vi.setSystemTime(new Date(NOW_MS));
    const rate = createStoredRate({ xrc_timestamp_seconds: FRESH_XRC_TIMESTAMP_SECONDS });
    const actor = {
      get_latest_xrc_btc_usd_rate: vi.fn().mockResolvedValue([rate]),
    } as unknown as _SERVICE;
    getCanisterActorMock.mockResolvedValue(actor);
    getLatestSnapshotResponseJson.mockResolvedValue(null);

    // when
    await syncXrcPriceFromCanister({ repository });

    // then
    expect(logErrorMock).not.toHaveBeenCalled();
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

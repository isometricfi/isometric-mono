import { beforeEach, describe, expect, test, vi } from "vitest";

import type { IXrcSnapshotRepository } from "@/lib/repositories/xrc-snapshot/xrc-snapshot-repository.interface";
import { syncXrcPriceSnapshot } from "./usecase";

vi.mock("@/lib/telemetry/withSpan", () => ({
  withSpan: async <T>(_name: string, fn: () => Promise<T>): Promise<T> => fn(),
}));

vi.mock("@/lib/repositories/xrc-snapshot/get-xrc-snapshot-repository", () => ({
  getXrcSnapshotRepository: vi.fn(),
}));

const getActorMock = vi.fn();

vi.mock("@/lib/canister-server", () => ({
  getCanisterActor: () => getActorMock(),
}));

describe("syncXrcPriceSnapshot", () => {
  beforeEach(() => {
    getActorMock.mockReset();
  });

  test("should append a new row with validated JSON for each run", async () => {
    // given
    const FIXED_NOW_MS = Date.UTC(2026, 4, 5, 14, 17, 0);
    const insertSnapshot = vi.fn().mockResolvedValue({ id: 42 });
    const repository: IXrcSnapshotRepository = {
      insertSnapshot,
    };

    const xrcResult = {
      Ok: {
        metadata: {
          decimals: 9,
          forex_timestamp: [],
          quote_asset_num_received_rates: BigInt(4),
          base_asset_num_received_rates: BigInt(4),
          base_asset_num_queried_sources: BigInt(4),
          standard_deviation: BigInt(0),
          quote_asset_num_queried_sources: BigInt(4),
        },
        rate: BigInt(95_000_000_000_000),
        timestamp: BigInt(1_749_456_900),
        quote_asset: {
          class: { FiatCurrency: null },
          symbol: "USD",
        },
        base_asset: {
          class: { Cryptocurrency: null },
          symbol: "BTC",
        },
      },
    };

    getActorMock.mockResolvedValue({
      fetch_xrc_btc_usd_exchange_rate_snapshot: vi.fn().mockResolvedValue({
        Ok: xrcResult,
      }),
    });

    // when
    const result = await syncXrcPriceSnapshot({
      repository,
      nowMs: () => FIXED_NOW_MS,
    });

    // then
    expect(insertSnapshot).toHaveBeenCalledTimes(1);
    const saved = insertSnapshot.mock.calls[0][0];
    expect(saved.responseJson).toContain('"Ok"');
    expect(saved.responseJson).toContain('"rate":"95000000000000"');
    expect(saved.fetchedAtMs).toBe(FIXED_NOW_MS);
    expect(result.id).toBe(42);
    expect(result.fetchedAtMs).toBe(FIXED_NOW_MS);
  });
});

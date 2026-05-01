import type { DrizzleD1Database } from "drizzle-orm/d1";
import { describe, expect, test, vi } from "vitest";
import type * as dbSchema from "@/lib/db/schema";
import {
  DrizzleMarketDataRepository,
  fromUsdMicros,
  toUsdMicros,
} from "./drizzle-market-data.repository";
import type { BtcHistoryPointToSave } from "./market-data-repository.interface";

const MAX_EXPECTED_D1_BOUND_PARAMETERS = 100;
const BTC_HISTORY_POINT_SQL_VARIABLES = 4;
const MAX_EXPECTED_HISTORY_POINTS_PER_D1_INSERT = Math.floor(
  MAX_EXPECTED_D1_BOUND_PARAMETERS / BTC_HISTORY_POINT_SQL_VARIABLES,
);

describe("USD micros conversion", () => {
  test("should preserve Bitcoin USD prices across storage conversion", () => {
    // given
    const PRICE_USD = 62_345.123456;
    const EXPECTED_PRICE_USD_MICROS = 62_345_123_456;

    // when
    const priceUsdMicros = toUsdMicros(PRICE_USD);
    const restoredPriceUsd = fromUsdMicros(priceUsdMicros);

    // then
    expect(priceUsdMicros).toBe(EXPECTED_PRICE_USD_MICROS);
    expect(restoredPriceUsd).toBe(PRICE_USD);
  });
});

describe("DrizzleMarketDataRepository", () => {
  test("should split history inserts under the D1 SQL variable limit", async () => {
    // given
    const POINT_COUNT = MAX_EXPECTED_HISTORY_POINTS_PER_D1_INSERT + 1;
    const FIRST_TIMESTAMP_MS = 1_700_000_000_000;
    const PRICE_USD = 62_345.12;
    const UPDATED_AT_MS = 1_700_001_000_000;
    const insertedBatches: unknown[][] = [];
    const db = {
      insert: vi.fn().mockReturnValue({
        values: vi.fn((values: unknown[]) => {
          insertedBatches.push(values);
          return {
            onConflictDoUpdate: vi.fn().mockResolvedValue(undefined),
          };
        }),
      }),
    } as unknown as DrizzleD1Database<typeof dbSchema>;
    const repository = new DrizzleMarketDataRepository(db);
    const points = Array.from(
      { length: POINT_COUNT },
      (_, index): BtcHistoryPointToSave => ({
        timestampMs: FIRST_TIMESTAMP_MS + index,
        priceUsd: PRICE_USD,
        source: "coinbase_exchange",
        updatedAtMs: UPDATED_AT_MS,
      }),
    );

    // when
    await repository.saveBtcHistoryPoints(points);

    // then
    const EXPECTED_BATCH_SIZES = [MAX_EXPECTED_HISTORY_POINTS_PER_D1_INSERT, 1];
    expect(insertedBatches.map((batch) => batch.length)).toEqual(EXPECTED_BATCH_SIZES);
  });
});

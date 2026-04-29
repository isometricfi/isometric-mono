import { asc, desc, gte, sql } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import type * as dbSchema from "@/lib/db/schema";
import { btcCurrentPrice, btcHistoryPoints } from "@/lib/db/schema";
import type {
  BtcCurrentPriceToSave,
  BtcHistoryPointToSave,
  IMarketDataRepository,
  StoredBtcCurrentPrice,
  StoredBtcHistoryPoint,
} from "./market-data-repository.interface";

const BTC_CURRENT_PRICE_ID = "bitcoin_usd";
const USD_MICROS_PER_USD = 1_000_000;
const MAX_D1_BOUND_PARAMETERS_PER_STATEMENT = 100;
const BTC_HISTORY_POINT_SQL_VARIABLES = 4;
const SAVE_HISTORY_POINTS_BATCH_SIZE = Math.floor(
  MAX_D1_BOUND_PARAMETERS_PER_STATEMENT / BTC_HISTORY_POINT_SQL_VARIABLES,
);

export class DrizzleMarketDataRepository implements IMarketDataRepository {
  constructor(private db: DrizzleD1Database<typeof dbSchema>) {}

  async saveCurrentBtcPrice(price: BtcCurrentPriceToSave): Promise<void> {
    const insertablePrice = {
      id: BTC_CURRENT_PRICE_ID,
      priceUsdMicros: toUsdMicros(price.priceUsd),
      source: price.source,
      updatedAtMs: price.updatedAtMs,
    };

    await this.db.insert(btcCurrentPrice).values(insertablePrice).onConflictDoUpdate({
      target: btcCurrentPrice.id,
      set: insertablePrice,
    });
  }

  async saveBtcHistoryPoints(points: BtcHistoryPointToSave[]): Promise<void> {
    if (points.length === 0) {
      return;
    }

    for (let i = 0; i < points.length; i += SAVE_HISTORY_POINTS_BATCH_SIZE) {
      const pointBatch = points.slice(i, i + SAVE_HISTORY_POINTS_BATCH_SIZE).map((point) => ({
        timestampMs: point.timestampMs,
        priceUsdMicros: toUsdMicros(point.priceUsd),
        source: point.source,
        updatedAtMs: point.updatedAtMs,
      }));

      await this.db
        .insert(btcHistoryPoints)
        .values(pointBatch)
        .onConflictDoUpdate({
          target: btcHistoryPoints.timestampMs,
          set: {
            priceUsdMicros: sql`excluded.price_usd_micros`,
            source: sql`excluded.source`,
            updatedAtMs: sql`excluded.updated_at_ms`,
          },
        });
    }
  }

  async getCurrentBtcPrice(): Promise<StoredBtcCurrentPrice | null> {
    const rows = await this.db
      .select({
        priceUsdMicros: btcCurrentPrice.priceUsdMicros,
        updatedAtMs: btcCurrentPrice.updatedAtMs,
      })
      .from(btcCurrentPrice)
      .limit(1);

    const row = rows[0];
    if (!row) {
      return null;
    }

    return {
      priceUsd: fromUsdMicros(row.priceUsdMicros),
      updatedAtMs: row.updatedAtMs,
    };
  }

  async getBtcHistoryPointsSince(timestampMs: number): Promise<StoredBtcHistoryPoint[]> {
    const rows = await this.db
      .select({
        timestampMs: btcHistoryPoints.timestampMs,
        priceUsdMicros: btcHistoryPoints.priceUsdMicros,
      })
      .from(btcHistoryPoints)
      .where(gte(btcHistoryPoints.timestampMs, timestampMs))
      .orderBy(asc(btcHistoryPoints.timestampMs));

    return rows.map((row) => ({
      timestampMs: row.timestampMs,
      priceUsd: fromUsdMicros(row.priceUsdMicros),
    }));
  }

  async getLatestBtcHistoryUpdatedAtMs(): Promise<number | null> {
    const rows = await this.db
      .select({
        updatedAtMs: btcHistoryPoints.updatedAtMs,
      })
      .from(btcHistoryPoints)
      .orderBy(desc(btcHistoryPoints.updatedAtMs))
      .limit(1);

    return rows[0]?.updatedAtMs ?? null;
  }
}

export function toUsdMicros(priceUsd: number): number {
  return Math.round(priceUsd * USD_MICROS_PER_USD);
}

export function fromUsdMicros(priceUsdMicros: number): number {
  return priceUsdMicros / USD_MICROS_PER_USD;
}

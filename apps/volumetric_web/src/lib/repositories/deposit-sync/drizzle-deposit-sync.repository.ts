import { and, asc, eq, inArray, lte, sql } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { z } from "zod";
import type * as dbSchema from "@/lib/db/schema";
import {
  depositBalanceSnapshots,
  depositSyncState,
  trackedDeposits,
  userDepositAddresses,
} from "@/lib/db/schema";
import type {
  BalanceSnapshot,
  DepositSyncCursor,
  IDepositSyncRepository,
  TrackedDeposit,
  UserDepositAddress,
} from "./deposit-sync-repository.interface";

const DEFAULT_QUERY_LIMIT = 500;
const PENDING_DEPOSIT_STATUSES = ["matured", "syncing"] as const;
const DEPOSIT_SYNC_CURSOR_DOC_ID = "cursor";

const trackedDepositSchema = z.object({
  key: z.string(),
  userAddress: z.string(),
  depositAddress: z.string(),
  txid: z.string(),
  vout: z.number(),
  valueSats: z.number(),
  firstSeenAtMs: z.number(),
  firstSeenHeight: z.number(),
  confirmations: z.number(),
  syncAttemptCount: z.number(),
  nextSyncAtMs: z.number(),
  lastSyncAtMs: z.number().nullable(),
  status: z.enum(["matured", "syncing", "credited", "expired"]),
  updatedAtMs: z.number(),
});

const userDepositAddressSchema = z.object({
  userAddress: z.string(),
  depositAddress: z.string(),
  updatedAtMs: z.number(),
});

const depositSyncCursorSchema = z.object({
  lastProcessedBlockHeight: z.number(),
  updatedAtMs: z.number(),
});

const linkedTransactionRefSchema = z.object({
  txid: z.string(),
  vout: z.number(),
});

export class DrizzleDepositSyncRepository implements IDepositSyncRepository {
  constructor(private db: DrizzleD1Database<typeof dbSchema>) {}

  async getTrackedDepositByKey(key: string): Promise<TrackedDeposit | null> {
    const rows = await this.db
      .select()
      .from(trackedDeposits)
      .where(eq(trackedDeposits.key, key))
      .limit(1);

    const row = rows[0];
    if (!row) {
      return null;
    }

    return trackedDepositSchema.parse(row);
  }

  async saveTrackedDeposit(deposit: TrackedDeposit): Promise<void> {
    await this.db
      .insert(trackedDeposits)
      .values(deposit)
      .onConflictDoUpdate({
        target: trackedDeposits.key,
        set: {
          userAddress: sql`excluded.user_address`,
          depositAddress: sql`excluded.deposit_address`,
          txid: sql`excluded.txid`,
          vout: sql`excluded.vout`,
          valueSats: sql`excluded.value_sats`,
          firstSeenAtMs: sql`excluded.first_seen_at_ms`,
          firstSeenHeight: sql`excluded.first_seen_height`,
          confirmations: sql`excluded.confirmations`,
          syncAttemptCount: sql`excluded.sync_attempt_count`,
          nextSyncAtMs: sql`excluded.next_sync_at_ms`,
          lastSyncAtMs: sql`excluded.last_sync_at_ms`,
          status: sql`excluded.status`,
          updatedAtMs: sql`excluded.updated_at_ms`,
        },
      });
  }

  async listDueTrackedDeposits(nowMs: number, limit: number): Promise<TrackedDeposit[]> {
    const effectiveLimit = Math.min(limit, DEFAULT_QUERY_LIMIT);
    const rows = await this.db
      .select()
      .from(trackedDeposits)
      .where(
        and(
          inArray(trackedDeposits.status, [...PENDING_DEPOSIT_STATUSES]),
          lte(trackedDeposits.nextSyncAtMs, nowMs),
        ),
      )
      .orderBy(asc(trackedDeposits.nextSyncAtMs))
      .limit(effectiveLimit);

    return rows.map((row) => trackedDepositSchema.parse(row));
  }

  async listUserPendingDeposits(userAddress: string): Promise<TrackedDeposit[]> {
    const rows = await this.db
      .select()
      .from(trackedDeposits)
      .where(
        and(
          eq(trackedDeposits.userAddress, userAddress),
          inArray(trackedDeposits.status, [...PENDING_DEPOSIT_STATUSES]),
        ),
      )
      .orderBy(asc(trackedDeposits.firstSeenAtMs))
      .limit(DEFAULT_QUERY_LIMIT);

    return rows.map((row) => trackedDepositSchema.parse(row));
  }

  async saveBalanceSnapshot(snapshot: BalanceSnapshot): Promise<void> {
    const insertableSnapshot = {
      id: snapshot.id,
      userAddress: snapshot.userAddress,
      beforeAvailableSats: snapshot.beforeAvailableSats,
      afterAvailableSats: snapshot.afterAvailableSats,
      deltaSats: snapshot.deltaSats,
      syncedAtMs: snapshot.syncedAtMs,
      linkedTxRefsJson: JSON.stringify(snapshot.linkedTxRefs),
    };

    await this.db
      .insert(depositBalanceSnapshots)
      .values(insertableSnapshot)
      .onConflictDoUpdate({
        target: depositBalanceSnapshots.id,
        set: {
          userAddress: sql`excluded.user_address`,
          beforeAvailableSats: sql`excluded.before_available_sats`,
          afterAvailableSats: sql`excluded.after_available_sats`,
          deltaSats: sql`excluded.delta_sats`,
          syncedAtMs: sql`excluded.synced_at_ms`,
          linkedTxRefsJson: sql`excluded.linked_tx_refs_json`,
        },
      });
  }

  async getUserDepositAddress(userAddress: string): Promise<UserDepositAddress | null> {
    const rows = await this.db
      .select()
      .from(userDepositAddresses)
      .where(eq(userDepositAddresses.userAddress, userAddress))
      .limit(1);

    const row = rows[0];
    if (!row) {
      return null;
    }

    return userDepositAddressSchema.parse(row);
  }

  async saveUserDepositAddress(record: UserDepositAddress): Promise<void> {
    await this.db
      .insert(userDepositAddresses)
      .values(record)
      .onConflictDoUpdate({
        target: userDepositAddresses.userAddress,
        set: {
          depositAddress: sql`excluded.deposit_address`,
          updatedAtMs: sql`excluded.updated_at_ms`,
        },
      });
  }

  async getDepositSyncCursor(): Promise<DepositSyncCursor | null> {
    const rows = await this.db
      .select({
        lastProcessedBlockHeight: depositSyncState.lastProcessedBlockHeight,
        updatedAtMs: depositSyncState.updatedAtMs,
      })
      .from(depositSyncState)
      .where(eq(depositSyncState.id, DEPOSIT_SYNC_CURSOR_DOC_ID))
      .limit(1);

    const row = rows[0];
    if (!row) {
      return null;
    }

    return depositSyncCursorSchema.parse(row);
  }

  async saveDepositSyncCursor(cursor: DepositSyncCursor): Promise<void> {
    await this.db
      .insert(depositSyncState)
      .values({
        id: DEPOSIT_SYNC_CURSOR_DOC_ID,
        lastProcessedBlockHeight: cursor.lastProcessedBlockHeight,
        updatedAtMs: cursor.updatedAtMs,
      })
      .onConflictDoUpdate({
        target: depositSyncState.id,
        set: {
          lastProcessedBlockHeight: sql`excluded.last_processed_block_height`,
          updatedAtMs: sql`excluded.updated_at_ms`,
        },
      });
  }
}

export function parseLinkedTransactionRefs(
  linkedTxRefsJson: string,
): BalanceSnapshot["linkedTxRefs"] {
  const parsedJson = JSON.parse(linkedTxRefsJson) as unknown;
  return z.array(linkedTransactionRefSchema).parse(parsedJson);
}

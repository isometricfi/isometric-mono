import { and, asc, eq, inArray, lte, sql } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { z } from "zod";
import type * as dbSchema from "@/lib/db/schema";
import { trackedWithdrawals } from "@/lib/db/schema";
import type {
  IWithdrawalSyncRepository,
  TrackedWithdrawal,
} from "./withdrawal-sync-repository.interface";

const DEFAULT_QUERY_LIMIT = 500;
const NON_TERMINAL_STATUSES = ["broadcasting", "pending"] as const;

const trackedWithdrawalSchema = z.object({
  operationId: z.string(),
  userAddress: z.string(),
  withdrawalId: z.number(),
  destinationAddress: z.string(),
  amountSats: z.number(),
  blockIndex: z.number().nullable(),
  bitcoinTxid: z.string().nullable(),
  confirmations: z.number(),
  phase: z.enum(["started", "approved", "retrieve_requested", "completed", "failed"]),
  lastError: z.string().nullable(),
  syncAttemptCount: z.number(),
  nextSyncAtMs: z.number(),
  lastSyncAtMs: z.number().nullable(),
  status: z.enum(["broadcasting", "pending", "completed", "failed", "expired"]),
  createdAtMs: z.number(),
  updatedAtMs: z.number(),
});

export class DrizzleWithdrawalSyncRepository implements IWithdrawalSyncRepository {
  constructor(private db: DrizzleD1Database<typeof dbSchema>) {}

  async getTrackedWithdrawalByOperationId(operationId: string): Promise<TrackedWithdrawal | null> {
    const rows = await this.db
      .select()
      .from(trackedWithdrawals)
      .where(eq(trackedWithdrawals.operationId, operationId))
      .limit(1);

    const row = rows[0];
    if (!row) {
      return null;
    }

    return trackedWithdrawalSchema.parse(row);
  }

  async saveTrackedWithdrawal(withdrawal: TrackedWithdrawal): Promise<void> {
    await this.db
      .insert(trackedWithdrawals)
      .values(withdrawal)
      .onConflictDoUpdate({
        target: trackedWithdrawals.operationId,
        set: {
          userAddress: sql`excluded.user_address`,
          withdrawalId: sql`excluded.withdrawal_id`,
          destinationAddress: sql`excluded.destination_address`,
          amountSats: sql`excluded.amount_sats`,
          blockIndex: sql`excluded.block_index`,
          bitcoinTxid: sql`excluded.bitcoin_txid`,
          confirmations: sql`excluded.confirmations`,
          phase: sql`excluded.phase`,
          lastError: sql`excluded.last_error`,
          syncAttemptCount: sql`excluded.sync_attempt_count`,
          nextSyncAtMs: sql`excluded.next_sync_at_ms`,
          lastSyncAtMs: sql`excluded.last_sync_at_ms`,
          status: sql`excluded.status`,
          updatedAtMs: sql`excluded.updated_at_ms`,
        },
      });
  }

  async listDueTrackedWithdrawals(nowMs: number, limit: number): Promise<TrackedWithdrawal[]> {
    const effectiveLimit = Math.min(limit, DEFAULT_QUERY_LIMIT);
    const rows = await this.db
      .select()
      .from(trackedWithdrawals)
      .where(
        and(
          inArray(trackedWithdrawals.status, [...NON_TERMINAL_STATUSES]),
          lte(trackedWithdrawals.nextSyncAtMs, nowMs),
        ),
      )
      .orderBy(asc(trackedWithdrawals.nextSyncAtMs))
      .limit(effectiveLimit);

    return rows.map((row) => trackedWithdrawalSchema.parse(row));
  }

  async listUserPendingWithdrawals(userAddress: string): Promise<TrackedWithdrawal[]> {
    const rows = await this.db
      .select()
      .from(trackedWithdrawals)
      .where(
        and(
          eq(trackedWithdrawals.userAddress, userAddress),
          inArray(trackedWithdrawals.status, [...NON_TERMINAL_STATUSES]),
        ),
      )
      .orderBy(asc(trackedWithdrawals.createdAtMs))
      .limit(DEFAULT_QUERY_LIMIT);

    return rows.map((row) => trackedWithdrawalSchema.parse(row));
  }
}

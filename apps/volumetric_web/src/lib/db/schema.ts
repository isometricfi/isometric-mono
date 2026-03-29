import { sql } from "drizzle-orm";
import { check, index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const events = sqliteTable(
  "events",
  {
    id: text("id").primaryKey(),
    idNum: integer("id_num").notNull(),
    eventType: text("event_type").notNull(),
    principal: text("principal").notNull(),
    timestamp: integer("timestamp").notNull(),
    dataJson: text("data_json").notNull(),
  },
  (table) => [
    uniqueIndex("events_id_num_unique").on(table.idNum),
    index("events_id_num_idx").on(table.idNum),
    index("events_principal_id_num_idx").on(table.principal, table.idNum),
    index("events_principal_timestamp_idx").on(table.principal, table.timestamp),
  ],
);

export const trackedDeposits = sqliteTable(
  "tracked_deposits",
  {
    key: text("key").primaryKey(),
    userAddress: text("user_address").notNull(),
    depositAddress: text("deposit_address").notNull(),
    txid: text("txid").notNull(),
    vout: integer("vout").notNull(),
    valueSats: integer("value_sats").notNull(),
    firstSeenAtMs: integer("first_seen_at_ms").notNull(),
    firstSeenHeight: integer("first_seen_height").notNull(),
    confirmations: integer("confirmations").notNull(),
    syncAttemptCount: integer("sync_attempt_count").notNull(),
    nextSyncAtMs: integer("next_sync_at_ms").notNull(),
    lastSyncAtMs: integer("last_sync_at_ms"),
    status: text("status").notNull(),
    updatedAtMs: integer("updated_at_ms").notNull(),
  },
  (table) => [
    index("tracked_deposits_status_next_sync_idx").on(table.status, table.nextSyncAtMs),
    index("tracked_deposits_user_status_first_seen_idx").on(
      table.userAddress,
      table.status,
      table.firstSeenAtMs,
    ),
    check(
      "tracked_deposits_status_check",
      sql`${table.status} in ('matured', 'syncing', 'credited', 'expired')`,
    ),
    check("tracked_deposits_vout_non_negative", sql`${table.vout} >= 0`),
    check("tracked_deposits_value_sats_non_negative", sql`${table.valueSats} >= 0`),
    check("tracked_deposits_confirmations_non_negative", sql`${table.confirmations} >= 0`),
    check("tracked_deposits_sync_attempt_count_non_negative", sql`${table.syncAttemptCount} >= 0`),
  ],
);

export const depositBalanceSnapshots = sqliteTable(
  "deposit_balance_snapshots",
  {
    id: text("id").primaryKey(),
    userAddress: text("user_address").notNull(),
    beforeAvailableSats: text("before_available_sats").notNull(),
    afterAvailableSats: text("after_available_sats").notNull(),
    deltaSats: text("delta_sats").notNull(),
    syncedAtMs: integer("synced_at_ms").notNull(),
    linkedTxRefsJson: text("linked_tx_refs_json").notNull(),
  },
  (table) => [
    index("deposit_balance_snapshots_user_synced_idx").on(table.userAddress, table.syncedAtMs),
  ],
);

export const userDepositAddresses = sqliteTable(
  "user_deposit_addresses",
  {
    userAddress: text("user_address").primaryKey(),
    depositAddress: text("deposit_address").notNull(),
    updatedAtMs: integer("updated_at_ms").notNull(),
  },
  (table) => [
    uniqueIndex("user_deposit_addresses_deposit_address_unique").on(table.depositAddress),
  ],
);

export const depositSyncState = sqliteTable(
  "deposit_sync_state",
  {
    id: text("id").primaryKey(),
    lastProcessedBlockHeight: integer("last_processed_block_height").notNull(),
    updatedAtMs: integer("updated_at_ms").notNull(),
  },
  (table) => [check("deposit_sync_state_cursor_only", sql`${table.id} = 'cursor'`)],
);

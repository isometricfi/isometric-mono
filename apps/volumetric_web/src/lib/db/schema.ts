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

export const trackedWithdrawals = sqliteTable(
  "tracked_withdrawals",
  {
    operationId: text("operation_id").primaryKey(),
    userAddress: text("user_address").notNull(),
    withdrawalId: integer("withdrawal_id").notNull(),
    destinationAddress: text("destination_address").notNull(),
    amountSats: integer("amount_sats").notNull(),
    blockIndex: integer("block_index"),
    bitcoinTxid: text("bitcoin_txid"),
    confirmations: integer("confirmations").notNull(),
    phase: text("phase").notNull(),
    lastError: text("last_error"),
    syncAttemptCount: integer("sync_attempt_count").notNull(),
    nextSyncAtMs: integer("next_sync_at_ms").notNull(),
    lastSyncAtMs: integer("last_sync_at_ms"),
    status: text("status").notNull(),
    createdAtMs: integer("created_at_ms").notNull(),
    updatedAtMs: integer("updated_at_ms").notNull(),
  },
  (table) => [
    index("tracked_withdrawals_status_next_sync_idx").on(table.status, table.nextSyncAtMs),
    index("tracked_withdrawals_user_status_created_idx").on(
      table.userAddress,
      table.status,
      table.createdAtMs,
    ),
    check(
      "tracked_withdrawals_status_check",
      sql`${table.status} in ('broadcasting', 'pending', 'completed', 'failed', 'expired')`,
    ),
    check("tracked_withdrawals_amount_non_negative", sql`${table.amountSats} >= 0`),
    check("tracked_withdrawals_confirmations_non_negative", sql`${table.confirmations} >= 0`),
    check(
      "tracked_withdrawals_sync_attempt_count_non_negative",
      sql`${table.syncAttemptCount} >= 0`,
    ),
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

export const waitlistSignups = sqliteTable(
  "waitlist_signups",
  {
    email: text("email").primaryKey(),
    createdAtMs: integer("created_at_ms").notNull(),
    locale: text("locale"),
  },
  (table) => [index("waitlist_signups_created_idx").on(table.createdAtMs)],
);

export const canisterLogShipCursor = sqliteTable(
  "canister_log_ship_cursor",
  {
    id: text("id").primaryKey(),
    lastShippedTimestampSeconds: integer("last_shipped_timestamp_seconds").notNull(),
    lastShippedCounter: integer("last_shipped_counter").notNull(),
    updatedAtMs: integer("updated_at_ms").notNull(),
  },
  (table) => [check("canister_log_ship_cursor_id_only", sql`${table.id} = 'cursor'`)],
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

export const btcCurrentPrice = sqliteTable(
  "btc_current_price",
  {
    id: text("id").primaryKey(),
    priceUsdMicros: integer("price_usd_micros").notNull(),
    source: text("source").notNull(),
    updatedAtMs: integer("updated_at_ms").notNull(),
  },
  (table) => [
    check("btc_current_price_id_only", sql`${table.id} = 'bitcoin_usd'`),
    check("btc_current_price_price_positive", sql`${table.priceUsdMicros} > 0`),
  ],
);

export const featureFlags = sqliteTable(
  "feature_flags",
  {
    key: text("key").primaryKey(),
    enabled: integer("enabled", { mode: "boolean" }).notNull().default(false),
    updatedAtMs: integer("updated_at_ms").notNull(),
  },
  (table) => [check("feature_flags_enabled_bool", sql`${table.enabled} in (0, 1)`)],
);

export const btcHistoryPoints = sqliteTable(
  "btc_history_points",
  {
    timestampMs: integer("timestamp_ms").primaryKey(),
    priceUsdMicros: integer("price_usd_micros").notNull(),
    source: text("source").notNull(),
    updatedAtMs: integer("updated_at_ms").notNull(),
  },
  (table) => [
    check("btc_history_points_timestamp_positive", sql`${table.timestampMs} > 0`),
    check("btc_history_points_price_positive", sql`${table.priceUsdMicros} > 0`),
  ],
);

export const xrcBtcUsdSnapshots = sqliteTable(
  "xrc_btc_usd_snapshots",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    fetchedAtMs: integer("fetched_at_ms").notNull(),
    responseJson: text("response_json").notNull(),
  },
  (table) => [check("xrc_snapshots_fetched_positive", sql`${table.fetchedAtMs} > 0`)],
);

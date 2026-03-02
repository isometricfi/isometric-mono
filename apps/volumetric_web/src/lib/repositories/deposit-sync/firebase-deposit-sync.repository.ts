import type { FirestoreClient } from "firebase-rest-firestore";
import { z } from "zod";
import type {
  BalanceSnapshot,
  DepositSyncCursor,
  IDepositSyncRepository,
  TrackedDeposit,
  UserDepositAddress,
} from "./deposit-sync-repository.interface";

const TRACKED_DEPOSITS_COLLECTION = "tracked_deposits";
const BALANCE_SNAPSHOTS_COLLECTION = "deposit_balance_snapshots";
const USER_DEPOSIT_ADDRESSES_COLLECTION = "user_deposit_addresses";
const DEPOSIT_SYNC_STATE_COLLECTION = "deposit_sync_state";
const DEFAULT_QUERY_LIMIT = 500;
const PENDING_DEPOSIT_STATUSES = ["matured", "syncing"] as const;
const DEPOSIT_SYNC_CURSOR_DOC_ID = "cursor";
type FirestoreRow = Record<string, unknown> & { id: string };

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

function isTrackedDeposit(value: unknown): value is TrackedDeposit {
  return trackedDepositSchema.safeParse(value).success;
}

function isUserDepositAddress(value: unknown): value is UserDepositAddress {
  return userDepositAddressSchema.safeParse(value).success;
}

function toTrackedDeposit(row: FirestoreRow): TrackedDeposit | null {
  const { id: _id, ...data } = row;
  return isTrackedDeposit(data) ? data : null;
}

function toUserDepositAddress(row: FirestoreRow): UserDepositAddress | null {
  const { id: _id, ...data } = row;
  return isUserDepositAddress(data) ? data : null;
}

function isDepositSyncCursor(value: unknown): value is DepositSyncCursor {
  return depositSyncCursorSchema.safeParse(value).success;
}

function toDepositSyncCursor(row: FirestoreRow): DepositSyncCursor | null {
  const { id: _id, ...data } = row;
  return isDepositSyncCursor(data) ? data : null;
}

export class FirebaseDepositSyncRepository implements IDepositSyncRepository {
  constructor(private client: FirestoreClient) {}

  async getTrackedDepositByKey(key: string): Promise<TrackedDeposit | null> {
    const rows = await this.client.query(TRACKED_DEPOSITS_COLLECTION, {
      where: [{ field: "key", op: "EQUAL", value: key }],
      limit: 1,
    });

    const tracked = rows
      .map((row) => toTrackedDeposit(row as FirestoreRow))
      .find((deposit): deposit is TrackedDeposit => deposit !== null);
    return tracked ?? null;
  }

  async saveTrackedDeposit(deposit: TrackedDeposit): Promise<void> {
    await this.client.collection(TRACKED_DEPOSITS_COLLECTION).doc(deposit.key).set(deposit);
  }

  async listDueTrackedDeposits(nowMs: number, limit: number): Promise<TrackedDeposit[]> {
    const effectiveLimit = Math.min(limit, DEFAULT_QUERY_LIMIT);
    const rows = await this.client.query(TRACKED_DEPOSITS_COLLECTION, {
      where: [
        { field: "status", op: "IN", value: [...PENDING_DEPOSIT_STATUSES] },
        { field: "nextSyncAtMs", op: "LESS_THAN_OR_EQUAL", value: nowMs },
      ],
      orderBy: "nextSyncAtMs",
      limit: effectiveLimit,
    });

    return rows
      .map((row) => toTrackedDeposit(row as FirestoreRow))
      .filter((deposit): deposit is TrackedDeposit => deposit !== null);
  }

  async listUserPendingDeposits(userAddress: string): Promise<TrackedDeposit[]> {
    const rows = await this.client.query(TRACKED_DEPOSITS_COLLECTION, {
      where: [
        { field: "userAddress", op: "EQUAL", value: userAddress },
        { field: "status", op: "IN", value: [...PENDING_DEPOSIT_STATUSES] },
      ],
      orderBy: "firstSeenAtMs",
      limit: DEFAULT_QUERY_LIMIT,
    });

    return rows
      .map((row) => toTrackedDeposit(row as FirestoreRow))
      .filter((deposit): deposit is TrackedDeposit => deposit !== null);
  }

  async saveBalanceSnapshot(snapshot: BalanceSnapshot): Promise<void> {
    await this.client.collection(BALANCE_SNAPSHOTS_COLLECTION).doc(snapshot.id).set(snapshot);
  }

  async getUserDepositAddress(userAddress: string): Promise<UserDepositAddress | null> {
    const rows = await this.client.query(USER_DEPOSIT_ADDRESSES_COLLECTION, {
      where: [{ field: "userAddress", op: "EQUAL", value: userAddress }],
      limit: 1,
    });

    const record = rows
      .map((row) => toUserDepositAddress(row as FirestoreRow))
      .find((value): value is UserDepositAddress => value !== null);

    return record ?? null;
  }

  async saveUserDepositAddress(record: UserDepositAddress): Promise<void> {
    await this.client
      .collection(USER_DEPOSIT_ADDRESSES_COLLECTION)
      .doc(record.userAddress)
      .set(record);
  }

  async getDepositSyncCursor(): Promise<DepositSyncCursor | null> {
    const row = await this.client.get(DEPOSIT_SYNC_STATE_COLLECTION, DEPOSIT_SYNC_CURSOR_DOC_ID);
    if (!row) {
      return null;
    }

    const cursor = toDepositSyncCursor(row as FirestoreRow);
    return cursor ?? null;
  }

  async saveDepositSyncCursor(cursor: DepositSyncCursor): Promise<void> {
    await this.client
      .collection(DEPOSIT_SYNC_STATE_COLLECTION)
      .doc(DEPOSIT_SYNC_CURSOR_DOC_ID)
      .set(cursor);
  }
}

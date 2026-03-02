import type { FirestoreClient } from "firebase-rest-firestore";
import { z } from "zod";
import type {
  BalanceSnapshot,
  IDepositSyncRepository,
  TrackedDeposit,
} from "./deposit-sync-repository.interface";

const TRACKED_DEPOSITS_COLLECTION = "tracked_deposits";
const BALANCE_SNAPSHOTS_COLLECTION = "deposit_balance_snapshots";
const DEFAULT_QUERY_LIMIT = 500;
const PENDING_DEPOSIT_STATUSES = ["matured", "syncing"] as const;
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

function isTrackedDeposit(value: unknown): value is TrackedDeposit {
  return trackedDepositSchema.safeParse(value).success;
}

function toTrackedDeposit(row: FirestoreRow): TrackedDeposit | null {
  const { id: _id, ...data } = row;
  return isTrackedDeposit(data) ? data : null;
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
}

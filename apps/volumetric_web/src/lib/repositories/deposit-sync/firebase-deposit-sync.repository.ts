import type { FirestoreClient } from "firebase-rest-firestore";
import type {
  BalanceSnapshot,
  IDepositSyncRepository,
  TrackedDeposit,
} from "./deposit-sync-repository.interface";

const TRACKED_DEPOSITS_COLLECTION = "tracked_deposits";
const BALANCE_SNAPSHOTS_COLLECTION = "deposit_balance_snapshots";
const DEFAULT_QUERY_LIMIT = 500;
type FirestoreRow = Record<string, unknown> & { id: string };

function isDepositStatus(value: unknown): value is TrackedDeposit["status"] {
  return value === "matured" || value === "syncing" || value === "credited" || value === "expired";
}

function isTrackedDeposit(value: unknown): value is TrackedDeposit {
  if (!value || typeof value !== "object") {
    return false;
  }

  const row = value as Record<string, unknown>;
  return (
    typeof row.key === "string" &&
    typeof row.userAddress === "string" &&
    typeof row.depositAddress === "string" &&
    typeof row.txid === "string" &&
    typeof row.vout === "number" &&
    typeof row.valueSats === "number" &&
    typeof row.firstSeenAtMs === "number" &&
    typeof row.firstSeenHeight === "number" &&
    typeof row.confirmations === "number" &&
    typeof row.syncAttemptCount === "number" &&
    typeof row.nextSyncAtMs === "number" &&
    (typeof row.lastSyncAtMs === "number" || row.lastSyncAtMs === null) &&
    isDepositStatus(row.status) &&
    typeof row.updatedAtMs === "number"
  );
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
    const rows = await this.client.query(TRACKED_DEPOSITS_COLLECTION, {
      orderBy: "nextSyncAtMs",
      limit: Math.min(limit, DEFAULT_QUERY_LIMIT),
    });

    const tracked = rows
      .map((row) => toTrackedDeposit(row as FirestoreRow))
      .filter((deposit): deposit is TrackedDeposit => deposit !== null);
    return tracked.filter(
      (deposit) =>
        (deposit.status === "matured" || deposit.status === "syncing") &&
        deposit.nextSyncAtMs <= nowMs,
    );
  }

  async listUserPendingDeposits(userAddress: string): Promise<TrackedDeposit[]> {
    const rows = await this.client.query(TRACKED_DEPOSITS_COLLECTION, {
      where: [{ field: "userAddress", op: "EQUAL", value: userAddress }],
      orderBy: "firstSeenAtMs",
      limit: DEFAULT_QUERY_LIMIT,
    });

    const tracked = rows
      .map((row) => toTrackedDeposit(row as FirestoreRow))
      .filter((deposit): deposit is TrackedDeposit => deposit !== null);
    return tracked.filter(
      (deposit) => deposit.status === "matured" || deposit.status === "syncing",
    );
  }

  async saveBalanceSnapshot(snapshot: BalanceSnapshot): Promise<void> {
    await this.client.collection(BALANCE_SNAPSHOTS_COLLECTION).doc(snapshot.id).set(snapshot);
  }
}

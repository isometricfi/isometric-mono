export type DepositSyncStatus = "matured" | "syncing" | "credited" | "expired";

export interface TrackedDeposit {
  key: string;
  userAddress: string;
  depositAddress: string;
  txid: string;
  vout: number;
  valueSats: number;
  firstSeenAtMs: number;
  firstSeenHeight: number;
  confirmations: number;
  syncAttemptCount: number;
  nextSyncAtMs: number;
  lastSyncAtMs: number | null;
  status: DepositSyncStatus;
  updatedAtMs: number;
}

export interface BalanceSnapshot {
  id: string;
  userAddress: string;
  beforeAvailableSats: string;
  afterAvailableSats: string;
  deltaSats: string;
  syncedAtMs: number;
  linkedTxRefs: Array<{ txid: string; vout: number }>;
}

export interface UserDepositAddress {
  userAddress: string;
  depositAddress: string;
  updatedAtMs: number;
}

export interface IDepositSyncRepository {
  getTrackedDepositByKey(key: string): Promise<TrackedDeposit | null>;
  saveTrackedDeposit(deposit: TrackedDeposit): Promise<void>;
  listDueTrackedDeposits(nowMs: number, limit: number): Promise<TrackedDeposit[]>;
  listUserPendingDeposits(userAddress: string): Promise<TrackedDeposit[]>;
  saveBalanceSnapshot(snapshot: BalanceSnapshot): Promise<void>;
  getUserDepositAddress(userAddress: string): Promise<UserDepositAddress | null>;
  saveUserDepositAddress(record: UserDepositAddress): Promise<void>;
}

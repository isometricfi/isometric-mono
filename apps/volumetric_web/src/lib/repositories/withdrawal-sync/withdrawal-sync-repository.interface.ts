export type WithdrawalSyncStatus = "broadcasting" | "pending" | "completed" | "failed" | "expired";

export type WithdrawalPhase =
  | "started"
  | "approved"
  | "retrieve_requested"
  | "completed"
  | "failed";

export interface TrackedWithdrawal {
  operationId: string;
  userAddress: string;
  withdrawalId: number;
  destinationAddress: string;
  amountSats: number;
  blockIndex: number | null;
  bitcoinTxid: string | null;
  confirmations: number;
  phase: WithdrawalPhase;
  lastError: string | null;
  syncAttemptCount: number;
  nextSyncAtMs: number;
  lastSyncAtMs: number | null;
  status: WithdrawalSyncStatus;
  createdAtMs: number;
  updatedAtMs: number;
}

export interface IWithdrawalSyncRepository {
  getTrackedWithdrawalByOperationId(operationId: string): Promise<TrackedWithdrawal | null>;
  saveTrackedWithdrawal(withdrawal: TrackedWithdrawal): Promise<void>;
  listDueTrackedWithdrawals(nowMs: number, limit: number): Promise<TrackedWithdrawal[]>;
  listUserPendingWithdrawals(userAddress: string): Promise<TrackedWithdrawal[]>;
}

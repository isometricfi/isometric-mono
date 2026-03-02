import type { Output } from "./schema";

interface SyncDepositsResultRaw {
  usersScanned: number;
  maturedDetected: number;
  syncCalls: number;
  creditedDeposits: number;
  snapshotsSaved: number;
}

export function mapResult(result: SyncDepositsResultRaw): Output {
  return {
    usersScanned: result.usersScanned,
    maturedDetected: result.maturedDetected,
    syncCalls: result.syncCalls,
    creditedDeposits: result.creditedDeposits,
    snapshotsSaved: result.snapshotsSaved,
  };
}

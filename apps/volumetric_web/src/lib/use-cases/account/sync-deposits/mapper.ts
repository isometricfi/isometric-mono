import type { Output } from "./schema";

interface SyncDepositsResultRaw {
  usersScanned: number;
  maturedDetected: number;
  detectionFailures: number;
  syncCalls: number;
  creditedDeposits: number;
  snapshotsSaved: number;
  reconciliationFailures: number;
}

export function mapResult(result: SyncDepositsResultRaw): Output {
  return {
    usersScanned: result.usersScanned,
    maturedDetected: result.maturedDetected,
    detectionFailures: result.detectionFailures,
    syncCalls: result.syncCalls,
    creditedDeposits: result.creditedDeposits,
    snapshotsSaved: result.snapshotsSaved,
    reconciliationFailures: result.reconciliationFailures,
  };
}

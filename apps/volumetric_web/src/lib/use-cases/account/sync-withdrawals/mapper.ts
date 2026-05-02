import type { Output } from "./schema";

export interface SyncWithdrawalsResultRaw {
  rowsProcessed: number;
  blockIndexResolved: number;
  txidResolved: number;
  completed: number;
  failed: number;
  expired: number;
}

export function mapResult(result: SyncWithdrawalsResultRaw): Output {
  return {
    rowsProcessed: result.rowsProcessed,
    blockIndexResolved: result.blockIndexResolved,
    txidResolved: result.txidResolved,
    completed: result.completed,
    failed: result.failed,
    expired: result.expired,
  };
}

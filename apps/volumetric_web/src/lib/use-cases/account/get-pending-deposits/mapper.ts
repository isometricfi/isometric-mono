import type { TrackedDeposit } from "@/lib/repositories/deposit-sync/deposit-sync-repository.interface";
import type { Output } from "./schema";

export function mapPendingDeposit(deposit: TrackedDeposit): Output["pendingDeposits"][number] {
  return {
    key: deposit.key,
    txid: deposit.txid,
    vout: deposit.vout,
    valueSats: deposit.valueSats,
    confirmations: deposit.confirmations,
    firstSeenAtMs: deposit.firstSeenAtMs,
    nextSyncAtMs: deposit.nextSyncAtMs,
    lastSyncAtMs: deposit.lastSyncAtMs,
    status: deposit.status === "syncing" ? "syncing" : "matured",
  };
}

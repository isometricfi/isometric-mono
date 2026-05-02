import type { TrackedWithdrawal } from "@/lib/repositories/withdrawal-sync/withdrawal-sync-repository.interface";
import type { Output } from "./schema";

export function mapPendingWithdrawal(
  withdrawal: TrackedWithdrawal,
): Output["pendingWithdrawals"][number] {
  return {
    operationId: withdrawal.operationId,
    destinationAddress: withdrawal.destinationAddress,
    amountSats: withdrawal.amountSats,
    bitcoinTxid: withdrawal.bitcoinTxid,
    confirmations: withdrawal.confirmations,
    status: withdrawal.status === "pending" ? "pending" : "broadcasting",
    createdAtMs: withdrawal.createdAtMs,
  };
}

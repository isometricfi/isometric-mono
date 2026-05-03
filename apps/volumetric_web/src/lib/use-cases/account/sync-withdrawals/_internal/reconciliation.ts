import type { _SERVICE } from "@volumetric/canister-types";
import { unwrapResult } from "@volumetric/canister-types";
import { getMempoolTipHeight, getMempoolTxStatus } from "@/lib/mempool-client";
import type {
  IWithdrawalSyncRepository,
  TrackedWithdrawal,
  WithdrawalPhase as TrackedWithdrawalPhase,
} from "@/lib/repositories/withdrawal-sync/withdrawal-sync-repository.interface";
import { mapCanisterWithdrawalPhase } from "../../../_shared/map-canister-withdrawal-phase";
import { resolveBitcoinTxidFromMinter } from "./minter-client";
import { hexToBytes } from "./operation-id";

export interface ReconcileTotals {
  blockIndexResolved: number;
  txidResolved: number;
  completed: number;
  failed: number;
  expired: number;
}

export interface ReconcileWithdrawalParams {
  repository: IWithdrawalSyncRepository;
  actor: _SERVICE;
  withdrawal: TrackedWithdrawal;
  nowMs: number;
  tipHeight: number | null;
  requiredConfirmations: number;
  maxAgeMs: number;
  getBackoffDelayMs: (attemptCount: number, ageMs: number) => number;
}

export async function reconcileTrackedWithdrawal(
  params: ReconcileWithdrawalParams,
): Promise<ReconcileTotals> {
  const totals: ReconcileTotals = {
    blockIndexResolved: 0,
    txidResolved: 0,
    completed: 0,
    failed: 0,
    expired: 0,
  };

  const { withdrawal, repository, nowMs, maxAgeMs } = params;

  const ageMs = nowMs - withdrawal.createdAtMs;
  if (ageMs > maxAgeMs) {
    await repository.saveTrackedWithdrawal({
      ...withdrawal,
      status: "expired",
      lastSyncAtMs: nowMs,
      updatedAtMs: nowMs,
    });
    totals.expired += 1;
    return totals;
  }

  const nextAttemptCount = withdrawal.syncAttemptCount + 1;
  const baseUpdate: TrackedWithdrawal = {
    ...withdrawal,
    syncAttemptCount: nextAttemptCount,
    lastSyncAtMs: nowMs,
    updatedAtMs: nowMs,
  };

  try {
    if (withdrawal.blockIndex === null) {
      const result = await params.actor.get_withdraw_status(hexToBytes(withdrawal.operationId));
      const status = unwrapResult(result);

      if ("Failed" in status) {
        await repository.saveTrackedWithdrawal({
          ...baseUpdate,
          phase: "failed",
          status: "failed",
          lastError: status.Failed.message,
        });
        totals.failed += 1;
        return totals;
      }

      let mappedPhase: TrackedWithdrawalPhase = baseUpdate.phase;
      let resolvedBlockIndex: number | null = null;

      if ("Pending" in status) {
        const mapped = mapCanisterWithdrawalPhase(status.Pending.phase);
        mappedPhase = mapped.phase;
        resolvedBlockIndex = mapped.blockIndex;
      } else if ("Succeeded" in status) {
        mappedPhase = "completed";
        resolvedBlockIndex = Number(status.Succeeded.result.block_index);
      } else if ("RecoveryRequired" in status) {
        const mapped = mapCanisterWithdrawalPhase(status.RecoveryRequired.phase);
        mappedPhase = mapped.phase;
        resolvedBlockIndex = mapped.blockIndex;
      }

      if (resolvedBlockIndex !== null) {
        totals.blockIndexResolved += 1;
        await repository.saveTrackedWithdrawal({
          ...baseUpdate,
          phase: mappedPhase,
          blockIndex: resolvedBlockIndex,
          nextSyncAtMs: nowMs,
          syncAttemptCount: 0,
        });
        return totals;
      }

      await repository.saveTrackedWithdrawal({
        ...baseUpdate,
        phase: mappedPhase,
        nextSyncAtMs: nowMs + params.getBackoffDelayMs(nextAttemptCount, ageMs),
      });
      return totals;
    }

    if (withdrawal.bitcoinTxid === null) {
      const resolution = await resolveBitcoinTxidFromMinter(withdrawal.blockIndex);

      if (resolution.kind === "txid") {
        totals.txidResolved += 1;
        await repository.saveTrackedWithdrawal({
          ...baseUpdate,
          bitcoinTxid: resolution.txid,
          status: "pending",
          nextSyncAtMs: nowMs,
          syncAttemptCount: 0,
        });
        return totals;
      }

      if (resolution.kind === "failed") {
        await repository.saveTrackedWithdrawal({
          ...baseUpdate,
          phase: "failed",
          status: "failed",
          lastError: resolution.reason,
        });
        totals.failed += 1;
        return totals;
      }

      await repository.saveTrackedWithdrawal({
        ...baseUpdate,
        nextSyncAtMs: nowMs + params.getBackoffDelayMs(nextAttemptCount, ageMs),
      });
      return totals;
    }

    const tipHeight = params.tipHeight;
    if (tipHeight === null) {
      await repository.saveTrackedWithdrawal({
        ...baseUpdate,
        nextSyncAtMs: nowMs + params.getBackoffDelayMs(nextAttemptCount, ageMs),
      });
      return totals;
    }

    const txStatus = await getMempoolTxStatus(withdrawal.bitcoinTxid);

    if (!txStatus?.confirmed || txStatus.block_height === undefined) {
      await repository.saveTrackedWithdrawal({
        ...baseUpdate,
        confirmations: 0,
        nextSyncAtMs: nowMs + params.getBackoffDelayMs(nextAttemptCount, ageMs),
      });
      return totals;
    }

    const confirmations = Math.max(0, tipHeight - txStatus.block_height + 1);

    if (confirmations >= params.requiredConfirmations) {
      await repository.saveTrackedWithdrawal({
        ...baseUpdate,
        confirmations,
        status: "completed",
      });
      totals.completed += 1;
      return totals;
    }

    await repository.saveTrackedWithdrawal({
      ...baseUpdate,
      confirmations,
      nextSyncAtMs: nowMs + params.getBackoffDelayMs(nextAttemptCount, ageMs),
    });
    return totals;
  } catch (error) {
    await repository.saveTrackedWithdrawal({
      ...baseUpdate,
      lastError: error instanceof Error ? error.message : String(error),
      nextSyncAtMs: nowMs + params.getBackoffDelayMs(nextAttemptCount, ageMs),
    });
    return totals;
  }
}

export async function getTipHeightSafe(): Promise<number | null> {
  try {
    return await getMempoolTipHeight();
  } catch {
    return null;
  }
}

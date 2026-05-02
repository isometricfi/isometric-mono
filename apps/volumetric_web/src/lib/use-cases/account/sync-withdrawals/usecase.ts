import { getCanisterActor } from "@/lib/canister-server";
import { getWithdrawalSyncRepository } from "@/lib/repositories/withdrawal-sync/get-withdrawal-sync-repository";
import { ATTR_RESULT_COUNT } from "@/lib/telemetry/traceConstants";
import { withSpan } from "@/lib/telemetry/withSpan";
import { getTipHeightSafe, reconcileTrackedWithdrawal } from "./_internal/reconciliation";
import { mapResult } from "./mapper";
import type { Output } from "./schema";

const REQUIRED_CONFIRMATIONS = 1;
const MAX_DUE_WITHDRAWALS_PER_TICK = 100;
const MAX_TRACKED_WITHDRAWAL_AGE_MS = 24 * 60 * 60 * 1000;
const FRESH_BROADCAST_WINDOW_MS = 5 * 60 * 1000;
const FRESH_BROADCAST_INTERVAL_MS = 60 * 1000;
const BASE_BACKOFF_1_MINUTE_MS = 60 * 1000;
const MAX_BACKOFF_16_MINUTES_MS = 16 * 60 * 1000;

const SYNC_WITHDRAWALS_SPAN_NAME = "usecase.account.sync_withdrawals";
const RECONCILE_SPAN_NAME = "sync_withdrawals.reconcile";

export async function syncWithdrawalsFromCanister(): Promise<Output> {
  return withSpan(SYNC_WITHDRAWALS_SPAN_NAME, async (span) => {
    const repository = getWithdrawalSyncRepository();
    const nowMs = Date.now();

    const dueWithdrawals = await repository.listDueTrackedWithdrawals(
      nowMs,
      MAX_DUE_WITHDRAWALS_PER_TICK,
    );

    if (dueWithdrawals.length === 0) {
      span.setAttribute(ATTR_RESULT_COUNT, 0);
      return mapResult({
        rowsProcessed: 0,
        blockIndexResolved: 0,
        txidResolved: 0,
        completed: 0,
        failed: 0,
        expired: 0,
      });
    }

    const [actor, tipHeight] = await Promise.all([getCanisterActor(), getTipHeightSafe()]);

    const totals = await withSpan(RECONCILE_SPAN_NAME, async () => {
      const reconciliationPromises = dueWithdrawals.map((withdrawal) =>
        reconcileTrackedWithdrawal({
          repository,
          actor,
          withdrawal,
          nowMs,
          tipHeight,
          requiredConfirmations: REQUIRED_CONFIRMATIONS,
          maxAgeMs: MAX_TRACKED_WITHDRAWAL_AGE_MS,
          getBackoffDelayMs,
        }),
      );
      const results = await Promise.all(reconciliationPromises);
      return results.reduce(
        (acc, item) => ({
          blockIndexResolved: acc.blockIndexResolved + item.blockIndexResolved,
          txidResolved: acc.txidResolved + item.txidResolved,
          completed: acc.completed + item.completed,
          failed: acc.failed + item.failed,
          expired: acc.expired + item.expired,
        }),
        { blockIndexResolved: 0, txidResolved: 0, completed: 0, failed: 0, expired: 0 },
      );
    });

    span.setAttribute(ATTR_RESULT_COUNT, dueWithdrawals.length);

    return mapResult({
      rowsProcessed: dueWithdrawals.length,
      ...totals,
    });
  });
}

function getBackoffDelayMs(attemptCount: number, ageMs: number): number {
  if (ageMs < FRESH_BROADCAST_WINDOW_MS) {
    return FRESH_BROADCAST_INTERVAL_MS;
  }

  if (attemptCount <= 0) {
    return 0;
  }

  const delay = BASE_BACKOFF_1_MINUTE_MS * 2 ** (attemptCount - 1);
  return Math.min(delay, MAX_BACKOFF_16_MINUTES_MS);
}

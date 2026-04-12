import { getCanisterActor } from "@/lib/canister-server";
import { getMempoolTipHeight } from "@/lib/mempool-client";
import { getDepositSyncRepository } from "@/lib/repositories/deposit-sync/get-deposit-sync-repository";
import { ATTR_RESULT_COUNT } from "@/lib/telemetry/traceConstants";
import { withSpan } from "@/lib/telemetry/withSpan";
import { detectMaturedDepositsForUser, groupDueDepositsByUser } from "./_internal/detection";
import { reconcileUserDepositsAfterSync } from "./_internal/reconciliation";
import { mapResult } from "./mapper";
import type { Output } from "./schema";

const DETECTION_CONFIRMATIONS = 1;
const MINTER_CONFIRMATIONS = 4;
const MAX_SYNC_ATTEMPTS = 6;
const MAX_DUE_DEPOSITS_PER_TICK = 200;
const MAX_TRACKED_DEPOSIT_AGE_6_HOURS_MS = 6 * 60 * 60 * 1000;
const BASE_BACKOFF_1_MINUTE_MS = 60 * 1000;
const MAX_BACKOFF_16_MINUTES_MS = 16 * 60 * 1000;
const ZERO_BIGINT = BigInt(0);

const SYNC_DEPOSITS_SPAN_NAME = "usecase.account.sync_deposits";
const LOAD_CURSOR_AND_TIP_SPAN_NAME = "sync_deposits.load_cursor_and_tip";
const LOAD_USERS_AND_LIMITS_SPAN_NAME = "sync_deposits.load_users_and_limits";
const DETECT_MATURED_DEPOSITS_SPAN_NAME = "sync_deposits.detect_matured_deposits";
const GROUP_DUE_DEPOSITS_SPAN_NAME = "sync_deposits.group_due_deposits";
const RECONCILE_DUE_DEPOSITS_SPAN_NAME = "sync_deposits.reconcile_due_deposits";
const SAVE_CURSOR_SPAN_NAME = "sync_deposits.save_cursor";

export async function syncDepositsFromCanister(): Promise<Output> {
  return withSpan(SYNC_DEPOSITS_SPAN_NAME, async () => {
    const repository = getDepositSyncRepository();
    const nowMs = Date.now();
    const { currentBlockTipHeight, cursor } = await withSpan(
      LOAD_CURSOR_AND_TIP_SPAN_NAME,
      async () => {
        const currentBlockTipHeight = await getMempoolTipHeight();
        const cursor = await repository.getDepositSyncCursor();
        return { currentBlockTipHeight, cursor };
      },
    );

    if (cursor?.lastProcessedBlockHeight === currentBlockTipHeight) {
      return mapResult({
        usersScanned: 0,
        maturedDetected: 0,
        syncCalls: 0,
        creditedDeposits: 0,
        snapshotsSaved: 0,
      });
    }

    const { actor, users } = await withSpan(LOAD_USERS_AND_LIMITS_SPAN_NAME, async () => {
      const actor = await getCanisterActor();
      const users = await actor.list_users();

      return { actor, users };
    });

    const maturedDetected = await withSpan(DETECT_MATURED_DEPOSITS_SPAN_NAME, async (span) => {
      const detectionPromises = users.map((user) =>
        detectMaturedDepositsForUser({
          repository,
          actor,
          userAddress: user.address,
          nowMs,
          currentBlockTipHeight,
          minterConfirmations: DETECTION_CONFIRMATIONS,
        }),
      );
      const detectionResults = await Promise.all(detectionPromises);
      const detectedDeposits = detectionResults.reduce((sum, count) => sum + count, 0);

      span.setAttribute(ATTR_RESULT_COUNT, detectedDeposits);
      return detectedDeposits;
    });

    const dueDepositsByUser = await withSpan(GROUP_DUE_DEPOSITS_SPAN_NAME, async () =>
      groupDueDepositsByUser({
        repository,
        nowMs,
        maxDueDepositsPerTick: MAX_DUE_DEPOSITS_PER_TICK,
        maxTrackedDepositAgeMs: MAX_TRACKED_DEPOSIT_AGE_6_HOURS_MS,
        minimumConfirmationsToSync: MINTER_CONFIRMATIONS,
      }),
    );

    const reconciliationTotals = await withSpan(RECONCILE_DUE_DEPOSITS_SPAN_NAME, async () => {
      const reconciliationPromises = Array.from(dueDepositsByUser.entries()).map(
        ([userAddress, dueDeposits]) =>
          reconcileUserDepositsAfterSync({
            repository,
            actor,
            userAddress,
            dueDeposits,
            nowMs,
            zeroBigInt: ZERO_BIGINT,
            maxSyncAttempts: MAX_SYNC_ATTEMPTS,
            getBackoffDelayMs,
          }),
      );
      const reconciliationResults = await Promise.all(reconciliationPromises);

      let totalSyncCalls = 0;
      let totalCreditedDeposits = 0;
      let totalSnapshotsSaved = 0;

      for (const reconciliationResult of reconciliationResults) {
        totalSyncCalls += reconciliationResult.syncCalls;
        totalCreditedDeposits += reconciliationResult.creditedDeposits;
        totalSnapshotsSaved += reconciliationResult.snapshotsSaved;
      }

      return {
        totalSyncCalls,
        totalCreditedDeposits,
        totalSnapshotsSaved,
      };
    });

    await withSpan(SAVE_CURSOR_SPAN_NAME, async () => {
      await repository.saveDepositSyncCursor({
        lastProcessedBlockHeight: currentBlockTipHeight,
        updatedAtMs: nowMs,
      });
    });

    return mapResult({
      usersScanned: users.length,
      maturedDetected,
      syncCalls: reconciliationTotals.totalSyncCalls,
      creditedDeposits: reconciliationTotals.totalCreditedDeposits,
      snapshotsSaved: reconciliationTotals.totalSnapshotsSaved,
    });
  });
}

function getBackoffDelayMs(attemptCount: number): number {
  if (attemptCount <= 0) {
    return 0;
  }

  const delay = BASE_BACKOFF_1_MINUTE_MS * 2 ** (attemptCount - 1);
  return Math.min(delay, MAX_BACKOFF_16_MINUTES_MS);
}

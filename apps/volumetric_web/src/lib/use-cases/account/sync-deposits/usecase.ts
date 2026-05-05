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
const DEPOSIT_DETECTION_BATCH_SIZE = 10;
const DEPOSIT_RECONCILIATION_BATCH_SIZE = 5;
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

interface BatchedResult<T> {
  values: T[];
  failures: number;
}

interface SyncDepositsDependencies {
  logFailure?: (message: string, error: unknown) => Promise<void>;
}

export async function syncDepositsFromCanister(
  dependencies: SyncDepositsDependencies = {},
): Promise<Output> {
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
        detectionFailures: 0,
        syncCalls: 0,
        creditedDeposits: 0,
        snapshotsSaved: 0,
        reconciliationFailures: 0,
      });
    }

    const { actor, users } = await withSpan(LOAD_USERS_AND_LIMITS_SPAN_NAME, async () => {
      const actor = await getCanisterActor();
      const listUsersResult = await actor.list_users();
      if ("Err" in listUsersResult) {
        throw new Error(`list_users failed: ${JSON.stringify(listUsersResult.Err)}`);
      }
      const users = listUsersResult.Ok;

      return { actor, users };
    });

    const detectionTotals = await withSpan(DETECT_MATURED_DEPOSITS_SPAN_NAME, async (span) => {
      const detectionResults = await runBatched(
        users,
        DEPOSIT_DETECTION_BATCH_SIZE,
        (user) =>
          detectMaturedDepositsForUser({
            repository,
            actor,
            userAddress: user.address,
            nowMs,
            currentBlockTipHeight,
            minterConfirmations: DETECTION_CONFIRMATIONS,
          }),
        (user) => `Failed to detect matured deposits for user ${user.address}`,
        dependencies.logFailure,
      );
      const detectedDeposits = detectionResults.values.reduce((sum, count) => sum + count, 0);

      span.setAttribute(ATTR_RESULT_COUNT, detectedDeposits);
      return {
        detectedDeposits,
        failures: detectionResults.failures,
      };
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
      const reconciliationResults = await runBatched(
        Array.from(dueDepositsByUser.entries()),
        DEPOSIT_RECONCILIATION_BATCH_SIZE,
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
        ([userAddress]) => `Failed to reconcile due deposits for user ${userAddress}`,
        dependencies.logFailure,
      );

      let totalSyncCalls = 0;
      let totalCreditedDeposits = 0;
      let totalSnapshotsSaved = 0;

      for (const reconciliationResult of reconciliationResults.values) {
        totalSyncCalls += reconciliationResult.syncCalls;
        totalCreditedDeposits += reconciliationResult.creditedDeposits;
        totalSnapshotsSaved += reconciliationResult.snapshotsSaved;
      }

      return {
        totalSyncCalls,
        totalCreditedDeposits,
        totalSnapshotsSaved,
        failures: reconciliationResults.failures,
      };
    });

    const hasIsolatedFailures = detectionTotals.failures > 0 || reconciliationTotals.failures > 0;

    if (!hasIsolatedFailures) {
      await withSpan(SAVE_CURSOR_SPAN_NAME, async () => {
        await repository.saveDepositSyncCursor({
          lastProcessedBlockHeight: currentBlockTipHeight,
          updatedAtMs: nowMs,
        });
      });
    }

    return mapResult({
      usersScanned: users.length,
      maturedDetected: detectionTotals.detectedDeposits,
      detectionFailures: detectionTotals.failures,
      syncCalls: reconciliationTotals.totalSyncCalls,
      creditedDeposits: reconciliationTotals.totalCreditedDeposits,
      snapshotsSaved: reconciliationTotals.totalSnapshotsSaved,
      reconciliationFailures: reconciliationTotals.failures,
    });
  });
}

async function runBatched<TInput, TOutput>(
  inputs: TInput[],
  batchSize: number,
  runItem: (input: TInput) => Promise<TOutput>,
  getFailureMessage: (input: TInput) => string,
  logFailure?: (message: string, error: unknown) => Promise<void>,
): Promise<BatchedResult<TOutput>> {
  const values: TOutput[] = [];
  let failures = 0;

  for (let startIndex = 0; startIndex < inputs.length; startIndex += batchSize) {
    const batch = inputs.slice(startIndex, startIndex + batchSize);
    const results = await Promise.allSettled(batch.map((input) => runItem(input)));

    for (let resultIndex = 0; resultIndex < results.length; resultIndex += 1) {
      const result = results[resultIndex];
      if (result.status === "fulfilled") {
        values.push(result.value);
        continue;
      }

      failures += 1;
      const input = batch[resultIndex];
      if (input !== undefined && logFailure) {
        await logFailure(getFailureMessage(input), result.reason);
      }
    }
  }

  return { values, failures };
}

function getBackoffDelayMs(attemptCount: number): number {
  if (attemptCount <= 0) {
    return 0;
  }

  const delay = BASE_BACKOFF_1_MINUTE_MS * 2 ** (attemptCount - 1);
  return Math.min(delay, MAX_BACKOFF_16_MINUTES_MS);
}

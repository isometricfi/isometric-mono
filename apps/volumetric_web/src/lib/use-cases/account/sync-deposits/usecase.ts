import { getCanisterActor } from "@/lib/canister-server";
import { getMempoolTipHeight } from "@/lib/mempool-client";
import { getDepositSyncRepository } from "@/lib/repositories/deposit-sync/get-deposit-sync-repository";
import { withWebSpan } from "@/lib/telemetry";
import { detectMaturedDepositsForUser, groupDueDepositsByUser } from "./_internal/detection";
import { reconcileUserDepositsAfterSync } from "./_internal/reconciliation";
import { mapResult } from "./mapper";
import type { Output } from "./schema";

const MINTER_CONFIRMATIONS = 4;
const MAX_SYNC_ATTEMPTS = 6;
const MAX_DUE_DEPOSITS_PER_TICK = 200;
const MAX_TRACKED_DEPOSIT_AGE_6_HOURS_MS = 6 * 60 * 60 * 1000;
const BASE_BACKOFF_1_MINUTE_MS = 60 * 1000;
const MAX_BACKOFF_16_MINUTES_MS = 16 * 60 * 1000;
const ZERO_BIGINT = BigInt(0);

export async function syncDepositsFromCanister(): Promise<Output> {
  return withWebSpan("web.usecase.sync_deposits", {}, async (span) => {
    const repository = getDepositSyncRepository();
    const nowMs = Date.now();
    const currentBlockTipHeight = await withWebSpan(
      "web.usecase.sync_deposits.get_mempool_tip_height",
      {},
      async () => getMempoolTipHeight(),
    );
    const cursor = await withWebSpan(
      "web.usecase.sync_deposits.get_deposit_sync_cursor",
      {},
      async () => repository.getDepositSyncCursor(),
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

    const actor = await withWebSpan("web.usecase.sync_deposits.get_actor", {}, async () =>
      getCanisterActor(),
    );
    const tradingLimits = await withWebSpan(
      "web.usecase.sync_deposits.get_trading_limits",
      {},
      async () => actor.get_trading_limits(),
    );
    const minDepositAmountSats = Number(tradingLimits.deposit_amount_sats);
    const users = await withWebSpan("web.usecase.sync_deposits.list_users", {}, async () =>
      actor.list_users(),
    );

    const detectionPromises = users.map((user) =>
      detectMaturedDepositsForUser({
        repository,
        actor,
        userAddress: user.address,
        nowMs,
        currentBlockTipHeight,
        minDepositAmountSats,
        minterConfirmations: MINTER_CONFIRMATIONS,
      }),
    );
    const detectionResults = await withWebSpan(
      "web.usecase.sync_deposits.detect_matured_deposits",
      { users_count: users.length },
      async () => Promise.all(detectionPromises),
    );
    const maturedDetected = detectionResults.reduce((sum, count) => sum + count, 0);

    const dueDepositsByUser = await withWebSpan(
      "web.usecase.sync_deposits.group_due_deposits",
      {},
      async () =>
        groupDueDepositsByUser({
          repository,
          nowMs,
          maxDueDepositsPerTick: MAX_DUE_DEPOSITS_PER_TICK,
          maxTrackedDepositAgeMs: MAX_TRACKED_DEPOSIT_AGE_6_HOURS_MS,
        }),
    );

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
    const reconciliationResults = await withWebSpan(
      "web.usecase.sync_deposits.reconcile_due_deposits",
      { users_with_due_deposits: dueDepositsByUser.size },
      async () => Promise.all(reconciliationPromises),
    );

    let totalSyncCalls = 0;
    let totalCreditedDeposits = 0;
    let totalSnapshotsSaved = 0;

    for (const reconciliationResult of reconciliationResults) {
      totalSyncCalls += reconciliationResult.syncCalls;
      totalCreditedDeposits += reconciliationResult.creditedDeposits;
      totalSnapshotsSaved += reconciliationResult.snapshotsSaved;
    }

    await withWebSpan("web.usecase.sync_deposits.save_sync_cursor", {}, async () =>
      repository.saveDepositSyncCursor({
        lastProcessedBlockHeight: currentBlockTipHeight,
        updatedAtMs: nowMs,
      }),
    );

    span.setAttribute("users_scanned", users.length);
    span.setAttribute("matured_detected", maturedDetected);
    span.setAttribute("sync_calls", totalSyncCalls);
    span.setAttribute("credited_deposits", totalCreditedDeposits);
    span.setAttribute("snapshots_saved", totalSnapshotsSaved);

    return mapResult({
      usersScanned: users.length,
      maturedDetected,
      syncCalls: totalSyncCalls,
      creditedDeposits: totalCreditedDeposits,
      snapshotsSaved: totalSnapshotsSaved,
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

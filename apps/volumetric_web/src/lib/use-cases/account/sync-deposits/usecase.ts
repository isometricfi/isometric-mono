import { getCanisterActor } from "@/lib/canister-server";
import { getMempoolTipHeight } from "@/lib/mempool-client";
import { getDepositSyncRepository } from "@/lib/repositories/deposit-sync/get-deposit-sync-repository";
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
  const repository = getDepositSyncRepository();
  const nowMs = Date.now();
  const currentBlockTipHeight = await getMempoolTipHeight();
  const actor = await getCanisterActor();
  const tradingLimits = await actor.get_trading_limits();
  const minDepositAmountSats = Number(tradingLimits.deposit_amount_sats);
  const users = await actor.list_users();

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
  const detectionResults = await Promise.all(detectionPromises);
  const maturedDetected = detectionResults.reduce((sum, count) => sum + count, 0);

  const dueDepositsByUser = await groupDueDepositsByUser({
    repository,
    nowMs,
    maxDueDepositsPerTick: MAX_DUE_DEPOSITS_PER_TICK,
    maxTrackedDepositAgeMs: MAX_TRACKED_DEPOSIT_AGE_6_HOURS_MS,
  });

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

  return mapResult({
    usersScanned: users.length,
    maturedDetected,
    syncCalls: totalSyncCalls,
    creditedDeposits: totalCreditedDeposits,
    snapshotsSaved: totalSnapshotsSaved,
  });
}

function getBackoffDelayMs(attemptCount: number): number {
  if (attemptCount <= 0) {
    return 0;
  }

  const delay = BASE_BACKOFF_1_MINUTE_MS * 2 ** (attemptCount - 1);
  return Math.min(delay, MAX_BACKOFF_16_MINUTES_MS);
}

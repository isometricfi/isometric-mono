import type { _SERVICE } from "@volumetric/canister-types";
import { unwrapResult } from "@volumetric/canister-types";
import type {
  IDepositSyncRepository,
  TrackedDeposit,
} from "@/lib/repositories/deposit-sync/deposit-sync-repository.interface";

interface ReconcileUserDepositsAfterSyncParams {
  repository: IDepositSyncRepository;
  actor: _SERVICE;
  userAddress: string;
  dueDeposits: TrackedDeposit[];
  nowMs: number;
  zeroBigInt: bigint;
  maxSyncAttempts: number;
  getBackoffDelayMs: (attemptCount: number) => number;
}

interface ReconcileUserDepositsAfterSyncResult {
  syncCalls: number;
  creditedDeposits: number;
  snapshotsSaved: number;
}

export async function reconcileUserDepositsAfterSync(
  params: ReconcileUserDepositsAfterSyncParams,
): Promise<ReconcileUserDepositsAfterSyncResult> {
  const {
    repository,
    actor,
    userAddress,
    dueDeposits,
    nowMs,
    zeroBigInt,
    maxSyncAttempts,
    getBackoffDelayMs,
  } = params;

  const beforeAvailableSats = await loadAvailableBalance(actor, userAddress, zeroBigInt);
  let afterAvailableSats = beforeAvailableSats;
  let syncSucceeded = false;

  try {
    await triggerSyncBalance(actor, userAddress);
    syncSucceeded = true;
    afterAvailableSats = await loadAvailableBalance(actor, userAddress, zeroBigInt);
  } catch {
    syncSucceeded = false;
  }

  const balanceDeltaSats =
    afterAvailableSats > beforeAvailableSats
      ? afterAvailableSats - beforeAvailableSats
      : zeroBigInt;

  let remainingBalanceDeltaSats = balanceDeltaSats;
  const linkedTransactionRefs: Array<{ txid: string; vout: number }> = [];
  let creditedDeposits = 0;

  const pendingDeposits = (await repository.listUserPendingDeposits(userAddress)).sort(
    (a, b) => a.firstSeenAtMs - b.firstSeenAtMs,
  );

  if (syncSucceeded && balanceDeltaSats > zeroBigInt) {
    for (const pendingDeposit of pendingDeposits) {
      if (remainingBalanceDeltaSats <= zeroBigInt) {
        break;
      }

      remainingBalanceDeltaSats -= BigInt(pendingDeposit.valueSats);
      linkedTransactionRefs.push({ txid: pendingDeposit.txid, vout: pendingDeposit.vout });
      creditedDeposits += 1;

      await repository.saveTrackedDeposit({
        ...pendingDeposit,
        status: "credited",
        lastSyncAtMs: nowMs,
        syncAttemptCount: pendingDeposit.syncAttemptCount + 1,
        updatedAtMs: nowMs,
      });
    }
  }

  for (const dueDeposit of dueDeposits) {
    const alreadyCredited = linkedTransactionRefs.some(
      (ref) => ref.txid === dueDeposit.txid && ref.vout === dueDeposit.vout,
    );

    if (alreadyCredited) {
      continue;
    }

    const nextAttemptCount = dueDeposit.syncAttemptCount + 1;
    const nextStatus = nextAttemptCount >= maxSyncAttempts ? "expired" : "matured";

    await repository.saveTrackedDeposit({
      ...dueDeposit,
      status: nextStatus,
      lastSyncAtMs: nowMs,
      syncAttemptCount: nextAttemptCount,
      nextSyncAtMs: nowMs + getBackoffDelayMs(nextAttemptCount),
      updatedAtMs: nowMs,
    });
  }

  await repository.saveBalanceSnapshot({
    id: `${userAddress}:${nowMs}`,
    userAddress,
    beforeAvailableSats: beforeAvailableSats.toString(),
    afterAvailableSats: afterAvailableSats.toString(),
    deltaSats: balanceDeltaSats.toString(),
    syncedAtMs: nowMs,
    linkedTxRefs: linkedTransactionRefs,
  });

  return {
    syncCalls: 1,
    creditedDeposits,
    snapshotsSaved: 1,
  };
}

async function loadAvailableBalance(
  actor: _SERVICE,
  address: string,
  zeroBigInt: bigint,
): Promise<bigint> {
  const result = await actor.get_user_balance(address);
  const data = unwrapResult(result);
  return data.available >= zeroBigInt ? data.available : zeroBigInt;
}

async function triggerSyncBalance(actor: _SERVICE, address: string): Promise<void> {
  const result = await actor.update_ckbtc_balance(address);
  unwrapResult(result);
}

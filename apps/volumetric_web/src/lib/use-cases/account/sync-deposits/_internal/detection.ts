import type { _SERVICE } from "@volumetric/canister-types";
import { unwrapResult } from "@volumetric/canister-types";
import { getMempoolAddressTransactions } from "@/lib/mempool-client";
import type {
  IDepositSyncRepository,
  TrackedDeposit,
} from "@/lib/repositories/deposit-sync/deposit-sync-repository.interface";

interface DetectMaturedDepositsForUserParams {
  repository: IDepositSyncRepository;
  actor: _SERVICE;
  userAddress: string;
  nowMs: number;
  currentBlockTipHeight: number;
  minDepositAmountSats: number;
  minterConfirmations: number;
}

interface GroupDueDepositsByUserParams {
  repository: IDepositSyncRepository;
  nowMs: number;
  maxDueDepositsPerTick: number;
  maxTrackedDepositAgeMs: number;
}

function getDepositTrackingKey(userAddress: string, txid: string, vout: number): string {
  return `${userAddress}:${txid}:${vout}`;
}

const depositAddressCache = new Map<string, string>();

async function resolveUserDepositAddress(
  repository: IDepositSyncRepository,
  actor: _SERVICE,
  address: string,
  nowMs: number,
): Promise<string | null> {
  const cached = depositAddressCache.get(address);
  if (cached) {
    return cached;
  }

  const persisted = await repository.getUserDepositAddress(address);
  if (persisted) {
    depositAddressCache.set(address, persisted.depositAddress);
    return persisted.depositAddress;
  }

  try {
    const result = await actor.get_deposit_address(address);
    const data = unwrapResult(result);
    depositAddressCache.set(address, data.btc_address);
    await repository.saveUserDepositAddress({
      userAddress: address,
      depositAddress: data.btc_address,
      updatedAtMs: nowMs,
    });
    return data.btc_address;
  } catch {
    return null;
  }
}

export async function detectMaturedDepositsForUser(
  params: DetectMaturedDepositsForUserParams,
): Promise<number> {
  const {
    repository,
    actor,
    userAddress,
    nowMs,
    currentBlockTipHeight,
    minDepositAmountSats,
    minterConfirmations,
  } = params;

  const depositAddress = await resolveUserDepositAddress(repository, actor, userAddress, nowMs);
  if (!depositAddress) {
    return 0;
  }

  let detectedCount = 0;
  const transactions = await getMempoolAddressTransactions(depositAddress);

  for (const tx of transactions) {
    const blockHeight = tx.status?.block_height;
    if (!tx.status?.confirmed || !blockHeight) {
      continue;
    }

    const confirmations = currentBlockTipHeight - blockHeight + 1;
    if (confirmations < minterConfirmations) {
      continue;
    }

    const outputs = tx.vout ?? [];
    for (let vout = 0; vout < outputs.length; vout += 1) {
      const output = outputs[vout];
      if (output.scriptpubkey_address !== depositAddress) {
        continue;
      }

      const valueSats = output.value ?? 0;
      if (valueSats < minDepositAmountSats) {
        continue;
      }

      const trackingKey = getDepositTrackingKey(userAddress, tx.txid, vout);
      const existingTrackedDeposit = await repository.getTrackedDepositByKey(trackingKey);
      if (existingTrackedDeposit) {
        if (existingTrackedDeposit.status === "credited") {
          continue;
        }

        await repository.saveTrackedDeposit({
          ...existingTrackedDeposit,
          confirmations,
          status:
            existingTrackedDeposit.status === "expired" ? "matured" : existingTrackedDeposit.status,
          updatedAtMs: nowMs,
        });
        continue;
      }

      detectedCount += 1;
      const trackedDeposit: TrackedDeposit = {
        key: trackingKey,
        userAddress,
        depositAddress,
        txid: tx.txid,
        vout,
        valueSats,
        firstSeenAtMs: nowMs,
        firstSeenHeight: blockHeight,
        confirmations,
        syncAttemptCount: 0,
        nextSyncAtMs: nowMs,
        lastSyncAtMs: null,
        status: "matured",
        updatedAtMs: nowMs,
      };

      await repository.saveTrackedDeposit(trackedDeposit);
    }
  }

  return detectedCount;
}

export async function groupDueDepositsByUser(
  params: GroupDueDepositsByUserParams,
): Promise<Map<string, TrackedDeposit[]>> {
  const { repository, nowMs, maxDueDepositsPerTick, maxTrackedDepositAgeMs } = params;

  const dueTrackedDeposits = await repository.listDueTrackedDeposits(nowMs, maxDueDepositsPerTick);
  const dueDepositsByUser = new Map<string, TrackedDeposit[]>();

  for (const trackedDeposit of dueTrackedDeposits) {
    const isTrackedDepositTooOld = nowMs - trackedDeposit.firstSeenAtMs > maxTrackedDepositAgeMs;
    if (isTrackedDepositTooOld) {
      await repository.saveTrackedDeposit({
        ...trackedDeposit,
        status: "expired",
        updatedAtMs: nowMs,
      });
      continue;
    }

    const existingUserDeposits = dueDepositsByUser.get(trackedDeposit.userAddress);
    if (!existingUserDeposits) {
      dueDepositsByUser.set(trackedDeposit.userAddress, [trackedDeposit]);
      continue;
    }

    existingUserDeposits.push(trackedDeposit);
  }

  return dueDepositsByUser;
}

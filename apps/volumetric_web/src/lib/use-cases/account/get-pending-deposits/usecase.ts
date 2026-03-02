import { getDepositSyncRepository } from "@/lib/repositories/deposit-sync/get-deposit-sync-repository";
import { mapPendingDeposit } from "./mapper";
import type { Output } from "./schema";

const MINTER_REQUIRED_CONFIRMATIONS = 4;

export async function getPendingDeposits(address: string): Promise<Output> {
  const repository = getDepositSyncRepository();
  const pendingDeposits = await repository.listUserPendingDeposits(address);

  const sortedPendingDeposits = [...pendingDeposits].sort(
    (a, b) => a.firstSeenAtMs - b.firstSeenAtMs,
  );

  return {
    requiredConfirmations: MINTER_REQUIRED_CONFIRMATIONS,
    pendingDeposits: sortedPendingDeposits.map(mapPendingDeposit),
  };
}

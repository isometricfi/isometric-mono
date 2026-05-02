import { getD1Db } from "@/lib/db/get-d1-db";
import { DrizzleWithdrawalSyncRepository } from "./drizzle-withdrawal-sync.repository";
import type { IWithdrawalSyncRepository } from "./withdrawal-sync-repository.interface";

let withdrawalSyncRepository: IWithdrawalSyncRepository | null = null;

export function getWithdrawalSyncRepository(): IWithdrawalSyncRepository {
  if (!withdrawalSyncRepository) {
    withdrawalSyncRepository = new DrizzleWithdrawalSyncRepository(getD1Db());
  }

  return withdrawalSyncRepository;
}

import { getD1Db } from "@/lib/db/get-d1-db";
import type { IDepositSyncRepository } from "./deposit-sync-repository.interface";
import { DrizzleDepositSyncRepository } from "./drizzle-deposit-sync.repository";

let depositSyncRepository: IDepositSyncRepository | null = null;

export function getDepositSyncRepository(): IDepositSyncRepository {
  if (!depositSyncRepository) {
    depositSyncRepository = new DrizzleDepositSyncRepository(getD1Db());
  }

  return depositSyncRepository;
}

import { getFirestore } from "@/lib/firebase";
import { withWebSpanWrappedMethods } from "@/lib/telemetry";
import type { IDepositSyncRepository } from "./deposit-sync-repository.interface";
import { FirebaseDepositSyncRepository } from "./firebase-deposit-sync.repository";

let depositSyncRepository: IDepositSyncRepository | null = null;

export function getDepositSyncRepository(): IDepositSyncRepository {
  if (!depositSyncRepository) {
    depositSyncRepository = withWebSpanWrappedMethods(
      "deposit_sync_repository",
      new FirebaseDepositSyncRepository(getFirestore()),
    );
  }

  return depositSyncRepository;
}

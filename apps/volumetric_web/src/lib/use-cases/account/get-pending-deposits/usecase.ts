import { getDepositSyncRepository } from "@/lib/repositories/deposit-sync/get-deposit-sync-repository";
import { ATTR_RESULT_COUNT } from "@/lib/telemetry/traceConstants";
import { withSpan } from "@/lib/telemetry/withSpan";
import { mapPendingDeposit } from "./mapper";
import type { Output } from "./schema";

const MINTER_REQUIRED_CONFIRMATIONS = 4;
const GET_PENDING_DEPOSITS_SPAN_NAME = "usecase.account.get_pending_deposits";

export async function getPendingDeposits(address: string): Promise<Output> {
  return withSpan(GET_PENDING_DEPOSITS_SPAN_NAME, async (span) => {
    const repository = getDepositSyncRepository();
    const pendingDeposits = await repository.listUserPendingDeposits(address);

    const sortedPendingDeposits = [...pendingDeposits].sort(
      (a, b) => a.firstSeenAtMs - b.firstSeenAtMs,
    );

    span.setAttribute(ATTR_RESULT_COUNT, sortedPendingDeposits.length);

    return {
      requiredConfirmations: MINTER_REQUIRED_CONFIRMATIONS,
      pendingDeposits: sortedPendingDeposits.map(mapPendingDeposit),
    };
  });
}

import { getWithdrawalSyncRepository } from "@/lib/repositories/withdrawal-sync/get-withdrawal-sync-repository";
import { ATTR_RESULT_COUNT } from "@/lib/telemetry/traceConstants";
import { withSpan } from "@/lib/telemetry/withSpan";
import { mapPendingWithdrawal } from "./mapper";
import type { Output } from "./schema";

const REQUIRED_CONFIRMATIONS = 1;
const GET_PENDING_WITHDRAWALS_SPAN_NAME = "usecase.account.get_pending_withdrawals";

export async function getPendingWithdrawals(address: string): Promise<Output> {
  return withSpan(GET_PENDING_WITHDRAWALS_SPAN_NAME, async (span) => {
    const repository = getWithdrawalSyncRepository();
    const pendingWithdrawals = await repository.listUserPendingWithdrawals(address);

    const sorted = [...pendingWithdrawals].sort((a, b) => a.createdAtMs - b.createdAtMs);

    span.setAttribute(ATTR_RESULT_COUNT, sorted.length);

    return {
      requiredConfirmations: REQUIRED_CONFIRMATIONS,
      pendingWithdrawals: sorted.map(mapPendingWithdrawal),
    };
  });
}

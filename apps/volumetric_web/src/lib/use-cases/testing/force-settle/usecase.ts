import type { SettlementStatus } from "@volumetric/canister-types";
import { unwrapResult } from "@volumetric/canister-types";
import { getCanisterActor } from "@/lib/canister-server";
import { withSpan } from "@/lib/telemetry/withSpan";
import { pollOperationStatusUntilTerminal } from "../../_shared/poll-operation-status";
import { mapResult } from "./mapper";
import type { Input, Output } from "./schema";

const FORCE_SETTLE_SPAN_NAME = "usecase.testing.force_settle";

export async function forceSettle(input: Input): Promise<Output> {
  return withSpan(FORCE_SETTLE_SPAN_NAME, async () => {
    const actor = await getCanisterActor();
    const result = await actor.testing_force_settle(BigInt(input.optionId));
    const receipt = unwrapResult(result);

    return pollOperationStatusUntilTerminal<SettlementStatus, Output>({
      getStatus: async () => {
        const settlementStatusResult = await actor.get_settlement_status(receipt.operation_id);
        return unwrapResult(settlementStatusResult);
      },
      mapTerminalStatus: (status) => {
        if ("Succeeded" in status) {
          return mapResult(status.Succeeded.result);
        }

        if ("Failed" in status) {
          throw new Error(status.Failed.message);
        }

        return null;
      },
    });
  });
}

import { getCanisterActor } from "@/lib/canister-server";
import { ATTR_RESULT_FOUND } from "@/lib/telemetry/traceConstants";
import { withSpan } from "@/lib/telemetry/withSpan";
import { mapBalance } from "./mapper";
import type { Output } from "./schema";

const GET_BALANCE_SPAN_NAME = "usecase.account.get_balance";

export async function getBalance(address: string): Promise<Output | null> {
  return withSpan(GET_BALANCE_SPAN_NAME, async (span) => {
    const actor = await getCanisterActor();
    const result = await actor.get_user_balance(address);

    const balanceData = "Ok" in result ? result.Ok : null;
    span.setAttribute(ATTR_RESULT_FOUND, balanceData !== null);
    return balanceData ? mapBalance(balanceData) : null;
  });
}

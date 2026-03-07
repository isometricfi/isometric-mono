import { unwrapResult } from "@volumetric/canister-types";
import { getCanisterActor } from "@/lib/canister-server";
import { withSpan } from "@/lib/telemetry/withSpan";
import { mapResult } from "./mapper";
import type { Output } from "./schema";

const GET_DEPOSIT_ADDRESS_SPAN_NAME = "usecase.account.get_deposit_address";

export async function getDepositAddress(address: string): Promise<Output> {
  return withSpan(GET_DEPOSIT_ADDRESS_SPAN_NAME, async () => {
    const actor = await getCanisterActor();
    const result = await actor.get_deposit_address(address);
    const data = unwrapResult(result);
    return mapResult(data);
  });
}

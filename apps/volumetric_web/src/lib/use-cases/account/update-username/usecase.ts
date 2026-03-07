import { unwrapResult } from "@volumetric/canister-types";
import { getCanisterActor } from "@/lib/canister-server";
import { withSpan } from "@/lib/telemetry/withSpan";
import { mapResult } from "./mapper";
import type { Input, Output } from "./schema";

const UPDATE_USERNAME_SPAN_NAME = "usecase.account.update_username";

export async function updateUsername(input: Input): Promise<Output> {
  return withSpan(UPDATE_USERNAME_SPAN_NAME, async () => {
    const actor = await getCanisterActor();

    const result = await actor.update_username({
      data: { username: input.username },
      wallet_proof: { address: input.address, signature: input.signature },
    });

    const data = unwrapResult(result);
    return mapResult(data);
  });
}

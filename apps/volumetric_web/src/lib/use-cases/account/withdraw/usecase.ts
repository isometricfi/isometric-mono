import { unwrapResult } from "@volumetric/canister-types";
import { getCanisterActor } from "@/lib/canister-server";
import { withSpan } from "@/lib/telemetry/withSpan";
import { mapResult } from "./mapper";
import type { Input, Output } from "./schema";

const WITHDRAW_SPAN_NAME = "usecase.account.withdraw";

export async function withdraw(input: Input): Promise<Output> {
  return withSpan(WITHDRAW_SPAN_NAME, async () => {
    const actor = await getCanisterActor();

    const result = await actor.withdraw_ckbtc({
      data: {
        btc_address: input.btcAddress,
        amount: BigInt(input.amount),
      },
      wallet_proof: { address: input.address, signature: input.signature },
    });

    const data = unwrapResult(result);
    return mapResult(data);
  });
}

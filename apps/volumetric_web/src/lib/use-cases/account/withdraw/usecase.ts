import { unwrapResult } from "@volumetric/canister-types";
import { getCanisterActor } from "@/lib/canister-server";
import { mapResult } from "./mapper";
import type { Input, Output } from "./schema";

export async function withdraw(input: Input): Promise<Output> {
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
}

import { unwrapResult } from "@volumetric/canister-types";
import { getCanisterActor } from "@/lib/canister-server";
import { withSpan } from "@/lib/telemetry/withSpan";
import { mapResult } from "./mapper";
import type { Input, Output } from "./schema";

const CREATE_OFFER_SPAN_NAME = "usecase.options.create_offer";

export async function createOffer(input: Input): Promise<Output> {
  return withSpan(CREATE_OFFER_SPAN_NAME, async () => {
    const actor = await getCanisterActor();

    const result = await actor.create_offer({
      wallet_proof: { address: input.address, signature: input.signature },
      data: {
        asset: { CkBtc: null },
        option_type: { Call: null },
        quantity: BigInt(input.quantity),
        strike_basis_points: input.strikeBasisPoints,
        premium_basis_points: input.premiumBasisPoints,
        offer_valid_until: BigInt(input.offerValidUntil),
        option_duration_seconds: BigInt(input.optionDurationSeconds),
      },
    });

    const data = unwrapResult(result);
    return mapResult(data);
  });
}

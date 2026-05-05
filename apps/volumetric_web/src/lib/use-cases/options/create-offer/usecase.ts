import { unwrapResult } from "@volumetric/canister-types";
import { getCanisterActor } from "@/lib/canister-server";
import { withSpan } from "@/lib/telemetry/withSpan";
import { toCanisterWalletProof } from "../../_shared/wallet-proof";
import { assertNotPaused } from "../../feature-flags/_shared/assert-not-paused";
import { mapResult } from "./mapper";
import type { Input, Output } from "./schema";

const CREATE_OFFER_SPAN_NAME = "usecase.options.create_offer";

export async function createOffer(input: Input): Promise<Output> {
  return withSpan(CREATE_OFFER_SPAN_NAME, async () => {
    await assertNotPaused();

    const actor = await getCanisterActor();

    const result = await actor.create_offer({
      wallet_proof: toCanisterWalletProof(input),
      data: {
        asset: { CkBtc: null },
        option_type: { Call: null },
        quantity: BigInt(input.quantity),
        strike_basis_points: input.strikeBasisPoints,
        premium_basis_points: input.premiumBasisPoints,
        offer_valid_until_seconds: BigInt(input.offerValidUntilSeconds),
        option_duration_seconds: BigInt(input.optionDurationSeconds),
        expires_at_seconds: BigInt(input.expiresAtSeconds),
      },
    });

    const data = unwrapResult(result);
    return mapResult(data);
  });
}

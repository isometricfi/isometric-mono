import { unwrapResult } from "@volumetric/canister-types";
import { getCanisterActor } from "@/lib/canister-server";
import { withSpan } from "@/lib/telemetry/withSpan";
import { toCanisterWalletProof } from "../../_shared/wallet-proof";
import type { Input, Output } from "./schema";

const CANCEL_OFFER_SPAN_NAME = "usecase.options.cancel_offer";

export async function cancelOffer(input: Input): Promise<Output> {
  return withSpan(CANCEL_OFFER_SPAN_NAME, async () => {
    const actor = await getCanisterActor();

    const result = await actor.cancel_offer({
      wallet_proof: toCanisterWalletProof(input),
      data: {
        offer_id: BigInt(input.offerId),
        expires_at_seconds: BigInt(input.expiresAtSeconds),
      },
    });

    unwrapResult(result);
    return { success: true };
  });
}

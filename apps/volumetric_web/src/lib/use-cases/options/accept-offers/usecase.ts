import type { AcceptOffersStatus } from "@volumetric/canister-types";
import { unwrapResult } from "@volumetric/canister-types";
import { getCanisterActor } from "@/lib/canister-server";
import { withSpan } from "@/lib/telemetry/withSpan";
import { pollOperationStatusUntilTerminal } from "../../_shared/poll-operation-status";
import { toCanisterWalletProof } from "../../_shared/wallet-proof";
import { assertNotPaused } from "../../feature-flags/_shared/assert-not-paused";
import { mapResult } from "./mapper";
import type { Input, Output } from "./schema";

const ACCEPT_OFFERS_SPAN_NAME = "usecase.options.accept_offers";

export async function acceptOffers(input: Input): Promise<Output> {
  return withSpan(ACCEPT_OFFERS_SPAN_NAME, async () => {
    await assertNotPaused();

    const actor = await getCanisterActor();

    const result = await actor.accept_offers({
      wallet_proof: toCanisterWalletProof(input),
      data: {
        items: input.items.map((item) => ({
          offer_id: BigInt(item.offerId),
          quantity: BigInt(item.quantity),
        })),
        expires_at_seconds: BigInt(input.expiresAtSeconds),
      },
    });

    const receipt = unwrapResult(result);
    return pollOperationStatusUntilTerminal<AcceptOffersStatus, Output>({
      getStatus: async () => {
        const acceptStatusResult = await actor.get_accept_status(receipt.operation_id);
        return unwrapResult(acceptStatusResult);
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

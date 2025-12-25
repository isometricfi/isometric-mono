import { unwrapResult } from "@volumetric/canister-types";
import { createApiHandler } from "@/lib/api-handler";
import { getCanisterActor } from "@/lib/canister-server";
import { mapWithdraw } from "./mapper";
import { WithdrawRequestSchema, type WithdrawResponse } from "./types";

export const POST = createApiHandler(
  WithdrawRequestSchema,
  async ({ address, signature, btcAddress, amount }): Promise<WithdrawResponse> => {
    const actor = await getCanisterActor();
    const result = await actor.withdraw_ckbtc({
      data: {
        btc_address: btcAddress,
        amount: BigInt(amount),
      },
      wallet_proof: { address, signature },
    });

    const data = unwrapResult(result);

    return mapWithdraw(data);
  },
);

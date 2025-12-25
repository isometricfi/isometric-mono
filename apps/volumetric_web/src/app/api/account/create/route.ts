import { unwrapResult } from "@volumetric/canister-types";
import { createApiHandler } from "@/lib/api-handler";
import { getCanisterActor } from "@/lib/canister-server";
import { mapCreateAccount } from "./mapper";
import { CreateAccountRequestSchema, type CreateAccountResponse } from "./types";

export const POST = createApiHandler(
  CreateAccountRequestSchema,
  async ({ address, signature }): Promise<CreateAccountResponse> => {
    const actor = await getCanisterActor();
    const result = await actor.create_account({
      data: {},
      wallet_proof: { address, signature },
    });

    const data = unwrapResult(result);

    return mapCreateAccount(data);
  },
);

import { unwrapResult } from "@volumetric/canister-types";
import { createApiHandler } from "@/lib/api-handler";
import { getCanisterActor } from "@/lib/canister-server";
import { mapUpdateUsername } from "./mapper";
import { UpdateUsernameRequestSchema, type UpdateUsernameResponse } from "./types";

export const POST = createApiHandler(
  UpdateUsernameRequestSchema,
  async ({ address, signature, username }): Promise<UpdateUsernameResponse> => {
    const actor = await getCanisterActor();
    const result = await actor.update_username({
      data: { username },
      wallet_proof: { address, signature },
    });

    const data = unwrapResult(result);

    return mapUpdateUsername(data);
  },
);

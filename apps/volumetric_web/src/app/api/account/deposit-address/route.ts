import { unwrapResult } from "@volumetric/canister-types";
import { createApiHandler } from "@/lib/api-handler";
import { getCanisterActor } from "@/lib/canister-server";
import { mapDepositAddress } from "./mapper";
import { DepositAddressRequestSchema, type DepositAddressResponse } from "./types";

export const POST = createApiHandler(
  DepositAddressRequestSchema,
  async ({ address }): Promise<DepositAddressResponse> => {
    const actor = await getCanisterActor();
    const result = await actor.get_deposit_address(address);
    const data = unwrapResult(result);

    return mapDepositAddress(data);
  },
);

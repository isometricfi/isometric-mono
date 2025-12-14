import { unwrapResult } from "@volumetric/canister-types";
import { z } from "zod";
import { createApiHandler } from "@/lib/api-handler";
import { getCanisterActor } from "@/lib/canister-server";

const RequestSchema = z.object({
  address: z.string().min(1),
  signature: z.string().min(1),
  username: z.string().min(1),
});

export type UpdateUsernameRequest = z.infer<typeof RequestSchema>;

const ResponseSchema = z.object({
  principal: z.string(),
  subaccount: z.array(z.number()),
  address: z.string(),
  username: z.string().nullable(),
});

export type UpdateUsernameResponse = z.infer<typeof ResponseSchema>;

export const POST = createApiHandler(RequestSchema, async ({ address, signature, username }) => {
  const actor = await getCanisterActor();
  const result = await actor.update_username({
    data: { username },
    wallet_proof: { address, signature },
  });

  const data = unwrapResult(result);

  return {
    principal: data.principal.toText(),
    subaccount: Array.from(data.subaccount),
    address: data.address,
    username: data.username[0] ?? null,
  } satisfies UpdateUsernameResponse;
});

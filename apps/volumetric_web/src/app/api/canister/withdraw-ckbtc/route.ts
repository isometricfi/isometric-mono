import { unwrapResult } from "@volumetric/canister-types";
import { NextResponse } from "next/server";
import { z } from "zod";
import { validateRequest, withApiHandler } from "@/lib/api-handler";
import { getCanisterActor } from "@/lib/canister-server";

const RequestSchema = z.object({
  address: z.string().min(1),
  signature: z.string().min(1),
  btcAddress: z.string().min(1),
  amount: z.string().regex(/^\d+$/, "Amount must be a numeric string"),
});

export type WithdrawCkbtcRequest = z.infer<typeof RequestSchema>;

const ResponseSchema = z.object({
  block_index: z.string(),
});

export type WithdrawCkbtcResponse = z.infer<typeof ResponseSchema>;

export const POST = withApiHandler(async (request: Request) => {
  const { address, signature, btcAddress, amount } = await validateRequest(request, RequestSchema);
  const actor = await getCanisterActor();
  const result = await actor.withdraw_ckbtc({
    data: {
      btc_address: btcAddress,
      amount: BigInt(amount),
    },
    wallet_proof: { address, signature },
  });

  const data = unwrapResult(result);

  return NextResponse.json({
    block_index: data.block_index.toString(),
  } satisfies WithdrawCkbtcResponse);
});

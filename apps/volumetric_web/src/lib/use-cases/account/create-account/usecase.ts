import { unwrapResult } from "@volumetric/canister-types";
import { getCanisterActor } from "@/lib/canister-server";
import { withSpan } from "@/lib/telemetry/withSpan";
import { toCanisterWalletProof } from "../../_shared/wallet-proof";
import { assertNotPaused } from "../../feature-flags/_shared/assert-not-paused";
import { mapResult } from "./mapper";
import type { Input, Output } from "./schema";

const CREATE_ACCOUNT_SPAN_NAME = "usecase.account.create_account";

export async function createAccount(input: Input): Promise<Output> {
  return withSpan(CREATE_ACCOUNT_SPAN_NAME, async () => {
    await assertNotPaused();

    const actor = await getCanisterActor();

    const result = await actor.create_account({
      data: {
        invite_code: input.inviteCode ? [input.inviteCode] : [],
        expires_at_seconds: BigInt(input.expiresAtSeconds),
      },
      wallet_proof: toCanisterWalletProof(input),
    });

    const data = unwrapResult(result);
    return mapResult(data);
  });
}

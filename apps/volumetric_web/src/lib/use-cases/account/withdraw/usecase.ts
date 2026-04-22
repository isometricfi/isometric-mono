import type { WithdrawStatus } from "@volumetric/canister-types";
import { unwrapResult } from "@volumetric/canister-types";
import { getCanisterActor } from "@/lib/canister-server";
import { withSpan } from "@/lib/telemetry/withSpan";
import { pollOperationStatusUntilTerminal } from "../../_shared/poll-operation-status";
import { toCanisterWalletProof } from "../../_shared/wallet-proof";
import { mapResult } from "./mapper";
import type { Input, Output } from "./schema";

const WITHDRAW_SPAN_NAME = "usecase.account.withdraw";

export async function withdraw(input: Input): Promise<Output> {
  return withSpan(WITHDRAW_SPAN_NAME, async () => {
    const actor = await getCanisterActor();

    const result = await actor.withdraw_ckbtc({
      data: {
        btc_address: input.btcAddress,
        amount: BigInt(input.amount),
        expires_at_seconds: BigInt(input.expiresAtSeconds),
      },
      wallet_proof: toCanisterWalletProof(input),
    });

    const receipt = unwrapResult(result);
    return pollOperationStatusUntilTerminal<WithdrawStatus, Output>({
      getStatus: async () => {
        const withdrawStatusResult = await actor.get_withdraw_status(receipt.operation_id);
        return unwrapResult(withdrawStatusResult);
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

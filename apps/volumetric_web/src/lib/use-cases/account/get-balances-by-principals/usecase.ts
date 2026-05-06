import type { Principal } from "@icp-sdk/core/principal";
import { getCanisterActor } from "@/lib/canister-server";
import { withSpan } from "@/lib/telemetry/withSpan";

const GET_BALANCES_BY_PRINCIPALS_SPAN_NAME = "usecase.account.get_balances_by_principals";
const BALANCE_BATCH_SIZE = 100;

export async function getBalancesByPrincipals(
  principals: Principal[],
): Promise<Map<string, bigint>> {
  return withSpan(GET_BALANCES_BY_PRINCIPALS_SPAN_NAME, async (span) => {
    span.setAttribute("principals_count", principals.length);

    const balancesByPrincipal = new Map<string, bigint>();
    if (principals.length === 0) {
      span.setAttribute("chunks_count", 0);
      return balancesByPrincipal;
    }

    const actor = await getCanisterActor();

    const chunks: Principal[][] = [];
    for (let i = 0; i < principals.length; i += BALANCE_BATCH_SIZE) {
      chunks.push(principals.slice(i, i + BALANCE_BATCH_SIZE));
    }
    span.setAttribute("chunks_count", chunks.length);

    const chunkResults = await Promise.allSettled(
      chunks.map((chunk) => actor.get_user_balances_by_principals(chunk)),
    );

    chunks.forEach((chunk, idx) => {
      const settled = chunkResults[idx];
      if (settled.status === "fulfilled" && "Ok" in settled.value) {
        const balances = settled.value.Ok;
        chunk.forEach((principal, principalIdx) => {
          const balance = balances[principalIdx];
          balancesByPrincipal.set(principal.toText(), balance ? balance.available : BigInt(0));
        });
      } else {
        chunk.forEach((principal) => {
          balancesByPrincipal.set(principal.toText(), BigInt(0));
        });
      }
    });

    return balancesByPrincipal;
  });
}

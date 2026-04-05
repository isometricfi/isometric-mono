import { profileFromGetAccountInfoResult } from "@volumetric/canister-types";
import { getCanisterActor } from "@/lib/canister-server";
import { ATTR_RESULT_FOUND } from "@/lib/telemetry/traceConstants";
import { withSpan } from "@/lib/telemetry/withSpan";
import { getHistory } from "../get-history/usecase";
import type { HistoryByHashOutput } from "./schema";

const GET_HISTORY_BY_HASH_SPAN_NAME = "usecase.history.get_history_by_hash";

export async function getHistoryByHash(address: string): Promise<HistoryByHashOutput> {
  return withSpan(GET_HISTORY_BY_HASH_SPAN_NAME, async (span) => {
    const actor = await getCanisterActor();
    const profileResult = await actor.get_account_info(address);
    const profile = profileFromGetAccountInfoResult(profileResult);

    span.setAttribute(ATTR_RESULT_FOUND, profile !== null);

    if (!profile) {
      return { entries: [], username: null, principal: undefined };
    }

    const principal = profile.principal.toString();
    const history = await getHistory(principal);

    return {
      entries: history.entries,
      username: profile.username.length > 0 ? (profile.username[0] ?? null) : null,
      principal,
    };
  });
}

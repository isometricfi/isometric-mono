import { getCanisterActor } from "@/lib/canister-server";
import { getHistory } from "../get-history/usecase";
import type { HistoryByHashOutput } from "./schema";

export async function getHistoryByHash(address: string): Promise<HistoryByHashOutput> {
  const actor = await getCanisterActor();
  const profileResult = await actor.get_account_info(address);
  const profile = profileResult.length > 0 ? profileResult[0] : null;

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
}

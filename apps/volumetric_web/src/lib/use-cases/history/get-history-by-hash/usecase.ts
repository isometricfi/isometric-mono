import { getHistory } from "../get-history/usecase";
import type { HistoryByHashOutput } from "./schema";

export async function getHistoryByHash(principalHash: string): Promise<HistoryByHashOutput> {
  const history = await getHistory(principalHash);

  // In a real app, we would look up the user profile by hash here.
  // For now, we'll mock it based on the hash to be deterministic.
  const isMockUser = principalHash.length > 0;
  const username = isMockUser ? `User ${principalHash.slice(0, 4)}` : null;

  return {
    entries: history.entries,
    username,
    principal: principalHash, // Using hash as principal proxy for now
  };
}

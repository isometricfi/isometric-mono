import { getCanisterActor } from "@/lib/canister-server";
import { mapBalance } from "./mapper";
import type { Output } from "./schema";

export async function getBalance(address: string): Promise<Output | null> {
  const actor = await getCanisterActor();
  const result = await actor.get_user_balance(address);

  const balanceData = "Ok" in result ? result.Ok : null;
  return balanceData ? mapBalance(balanceData) : null;
}

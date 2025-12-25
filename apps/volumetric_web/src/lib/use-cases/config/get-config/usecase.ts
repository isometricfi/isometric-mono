import { getCanisterActor } from "@/lib/canister-server";
import type { ConfigData } from "@/types/config";
import { mapConfig } from "./mapper";

export async function getConfig(): Promise<ConfigData> {
  const actor = await getCanisterActor();
  const rawLimits = await actor.get_trading_limits();
  return mapConfig(rawLimits);
}

import { getCanisterActor } from "@/lib/canister-server";
import type { ConfigData } from "@/types/config";
import { mapConfig } from "./mapper";

export async function getConfig(): Promise<ConfigData> {
  const actor = await getCanisterActor();
  const [rawLimits, rawFeeConfig] = await Promise.all([
    actor.get_trading_limits(),
    actor.get_fee_config(),
  ]);
  return mapConfig(rawLimits, rawFeeConfig);
}

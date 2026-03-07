import { getCanisterActor } from "@/lib/canister-server";
import { withSpan } from "@/lib/telemetry/withSpan";
import type { ConfigData } from "@/types/config";
import { mapConfig } from "./mapper";

const GET_CONFIG_SPAN_NAME = "usecase.config.get_config";

export async function getConfig(): Promise<ConfigData> {
  return withSpan(GET_CONFIG_SPAN_NAME, async () => {
    const actor = await getCanisterActor();
    const [rawLimits, rawFeeConfig] = await Promise.all([
      actor.get_trading_limits(),
      actor.get_fee_config(),
    ]);
    return mapConfig(rawLimits, rawFeeConfig);
  });
}

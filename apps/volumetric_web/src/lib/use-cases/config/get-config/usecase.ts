import { getCanisterActor } from "@/lib/canister-server";
import { withSpan } from "@/lib/telemetry/withSpan";
import type { ConfigData } from "@/types/config";
import { mapConfig } from "./mapper";

const GET_CONFIG_SPAN_NAME = "usecase.config.get_config";

export async function getConfig(): Promise<ConfigData> {
  return withSpan(GET_CONFIG_SPAN_NAME, async () => {
    const actor = await getCanisterActor();
    const [rawLimits, rawFeeConfigResult] = await Promise.all([
      actor.get_trading_limits(),
      actor.get_fee_config(),
    ]);
    if ("Err" in rawFeeConfigResult) {
      throw new Error(`get_fee_config failed: ${JSON.stringify(rawFeeConfigResult.Err)}`);
    }
    const rawFeeConfig = rawFeeConfigResult.Ok;
    return mapConfig(rawLimits, rawFeeConfig);
  });
}

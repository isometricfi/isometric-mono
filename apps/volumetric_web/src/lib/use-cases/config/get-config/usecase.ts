import { getCanisterActor } from "@/lib/canister-server";
import { logError } from "@/lib/telemetry/logs";
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
    const config = mapConfig(rawLimits, rawFeeConfig);

    if (config.termOptions.length === 0) {
      const { min, max } = rawLimits.option_duration_seconds;
      await logError(
        `No term day fits option_duration_seconds range [min=${min}s, max=${max}s]; term selector will be empty`,
      );
    }

    return config;
  });
}

import { getCanisterActor } from "@/lib/canister-server";
import { getCkbtcLedgerActor } from "@/lib/ckbtc-ledger-server";
import { logError } from "@/lib/telemetry/logs";
import { withSpan } from "@/lib/telemetry/withSpan";
import type { ConfigData } from "@/types/config";
import { mapConfig } from "./mapper";

const GET_CONFIG_SPAN_NAME = "usecase.config.get_config";

export async function getConfig(): Promise<ConfigData> {
  return withSpan(GET_CONFIG_SPAN_NAME, async () => {
    const actor = await getCanisterActor();
    const ledgerActor = await getCkbtcLedgerActor();
    const [rawLimits, rawFeeConfig, ckbtcTransferFeeSats] = await Promise.all([
      actor.get_trading_limits(),
      actor.get_fee_config(),
      ledgerActor.icrc1_fee(),
    ]);
    const config = mapConfig(rawLimits, rawFeeConfig, ckbtcTransferFeeSats);

    if (config.termOptions.length === 0) {
      const { min, max } = rawLimits.option_duration_seconds;
      await logError(
        `No term day fits option_duration_seconds range [min=${min}s, max=${max}s]; term selector will be empty`,
      );
    }

    return config;
  });
}

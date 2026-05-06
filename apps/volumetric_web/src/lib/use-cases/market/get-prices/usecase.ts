import { getCanisterActor } from "@/lib/canister-server";
import { withSpan } from "@/lib/telemetry/withSpan";
import { type Output, outputSchema } from "./schema";

const GET_MARKET_PRICES_SPAN_NAME = "usecase.market.get_prices";
const CENTS_PER_USD = 100;
const MILLISECONDS_PER_SECOND = 1_000;

interface Dependencies {
  getActor?: typeof getCanisterActor;
}

export async function getMarketPrices(dependencies: Dependencies = {}): Promise<Output> {
  return withSpan(GET_MARKET_PRICES_SPAN_NAME, async () => {
    const getActor = dependencies.getActor ?? getCanisterActor;
    const actor = await getActor();
    const [latestRate] = await actor.get_latest_xrc_btc_usd_rate();

    return outputSchema.parse({
      btc: latestRate ? Number(latestRate.price_cents) / CENTS_PER_USD : null,
      updatedAtMs: latestRate
        ? Number(latestRate.fetched_at_seconds) * MILLISECONDS_PER_SECOND
        : null,
    });
  });
}

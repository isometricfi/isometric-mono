import { getMarketDataRepository } from "@/lib/repositories/market/get-market-data-repository";
import type { IMarketDataRepository } from "@/lib/repositories/market/market-data-repository.interface";
import { withSpan } from "@/lib/telemetry/withSpan";
import { type Output, outputSchema } from "./schema";

const GET_MARKET_PRICES_SPAN_NAME = "usecase.market.get_prices";

export async function getMarketPrices(
  repository: IMarketDataRepository = getMarketDataRepository(),
): Promise<Output> {
  return withSpan(GET_MARKET_PRICES_SPAN_NAME, async () => {
    const price = await repository.getCurrentBtcPrice();

    return outputSchema.parse({
      btc: price?.priceUsd ?? null,
      updatedAtMs: price?.updatedAtMs ?? null,
    });
  });
}

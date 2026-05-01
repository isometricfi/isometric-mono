import { getMarketDataRepository } from "@/lib/repositories/market/get-market-data-repository";
import type { IMarketDataRepository } from "@/lib/repositories/market/market-data-repository.interface";
import { ATTR_RESULT_COUNT } from "@/lib/telemetry/traceConstants";
import { withSpan } from "@/lib/telemetry/withSpan";
import { type Input, inputSchema, type Output, outputSchema } from "./schema";

const GET_BTC_HISTORY_SPAN_NAME = "usecase.market.get_btc_history";
const MILLISECONDS_PER_DAY = 86_400_000;

export async function getBtcHistory(
  input: Input,
  repository: IMarketDataRepository = getMarketDataRepository(),
  nowMs = Date.now(),
): Promise<Output> {
  return withSpan(GET_BTC_HISTORY_SPAN_NAME, async (span) => {
    const parsedInput = inputSchema.parse(input);
    const oldestTimestampMs = nowMs - parsedInput.days * MILLISECONDS_PER_DAY;
    const historyPoints = await repository.getBtcHistoryPointsSince(oldestTimestampMs);
    const output = outputSchema.parse(
      historyPoints.map((point) => ({
        timestamp: point.timestampMs,
        price: point.priceUsd,
      })),
    );

    span.setAttribute(ATTR_RESULT_COUNT, output.length);
    return output;
  });
}

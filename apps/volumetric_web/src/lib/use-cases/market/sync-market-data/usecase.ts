import { DEFAULT_BTC_HISTORY_DAYS } from "@/lib/market/btc-history-limits";
import { fetchBtcHistoryQuotes, fetchCurrentBtcPriceQuote } from "@/lib/market/coingecko-client";
import { getMarketDataRepository } from "@/lib/repositories/market/get-market-data-repository";
import type { IMarketDataRepository } from "@/lib/repositories/market/market-data-repository.interface";
import { withSpan } from "@/lib/telemetry/withSpan";
import { type Output, outputSchema } from "./schema";

const SYNC_MARKET_DATA_SPAN_NAME = "usecase.market.sync_market_data";
const HISTORY_REFRESH_INTERVAL_30_MINUTES_MS = 30 * 60 * 1_000;

interface SyncMarketDataDependencies {
  repository?: IMarketDataRepository;
  fetchCurrentPriceQuote?: typeof fetchCurrentBtcPriceQuote;
  fetchHistoryQuotes?: typeof fetchBtcHistoryQuotes;
  nowMs?: () => number;
}

export async function syncBtcMarketData(
  dependencies: SyncMarketDataDependencies = {},
): Promise<Output> {
  return withSpan(SYNC_MARKET_DATA_SPAN_NAME, async () => {
    const repository = dependencies.repository ?? getMarketDataRepository();
    const fetchCurrentPriceQuote = dependencies.fetchCurrentPriceQuote ?? fetchCurrentBtcPriceQuote;
    const fetchHistoryQuotes = dependencies.fetchHistoryQuotes ?? fetchBtcHistoryQuotes;
    const nowMs = dependencies.nowMs?.() ?? Date.now();

    const currentPriceQuote = await fetchCurrentPriceQuote();
    await repository.saveCurrentBtcPrice({
      priceUsd: currentPriceQuote.priceUsd,
      source: currentPriceQuote.source,
      updatedAtMs: nowMs,
    });

    const latestHistoryUpdatedAtMs = await repository.getLatestBtcHistoryUpdatedAtMs();
    if (!shouldRefreshBtcHistory(latestHistoryUpdatedAtMs, nowMs)) {
      return outputSchema.parse({
        success: true,
        currentPriceUpdated: true,
        historyRefreshed: false,
        historyPointsSaved: 0,
      });
    }

    const historyQuotes = await fetchHistoryQuotes(DEFAULT_BTC_HISTORY_DAYS);
    await repository.saveBtcHistoryPoints(
      historyQuotes.map((quote) => ({
        timestampMs: quote.timestampMs,
        priceUsd: quote.priceUsd,
        source: quote.source,
        updatedAtMs: nowMs,
      })),
    );

    return outputSchema.parse({
      success: true,
      currentPriceUpdated: true,
      historyRefreshed: true,
      historyPointsSaved: historyQuotes.length,
    });
  });
}

export function shouldRefreshBtcHistory(
  latestHistoryUpdatedAtMs: number | null,
  nowMs: number,
): boolean {
  if (latestHistoryUpdatedAtMs === null) {
    return true;
  }

  return nowMs - latestHistoryUpdatedAtMs >= HISTORY_REFRESH_INTERVAL_30_MINUTES_MS;
}

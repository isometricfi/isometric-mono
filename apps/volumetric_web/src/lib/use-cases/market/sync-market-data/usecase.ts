import { DEFAULT_BTC_HISTORY_DAYS } from "@/lib/market/btc-history-limits";
import {
  type BtcHistoryQuote,
  fetchBtcHistoryQuotes,
  fetchCurrentBtcPriceQuote,
} from "@/lib/market/coinbase-client";
import { getMarketDataRepository } from "@/lib/repositories/market/get-market-data-repository";
import type { IMarketDataRepository } from "@/lib/repositories/market/market-data-repository.interface";
import { withSpan } from "@/lib/telemetry/withSpan";
import { type Output, outputSchema } from "./schema";

const SYNC_MARKET_DATA_SPAN_NAME = "usecase.market.sync_market_data";
const HISTORY_REFRESH_INTERVAL_6_HOURS_MS = 6 * 60 * 60 * 1_000;

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

    const latestHistoryUpdatedAtMs = await repository.getLatestBtcHistoryUpdatedAtMs();
    const shouldRefreshHistory = shouldRefreshBtcHistory(latestHistoryUpdatedAtMs, nowMs);

    const currentPriceQuote = await fetchCurrentPriceQuote();

    let historyQuotes: BtcHistoryQuote[] | null = null;
    if (shouldRefreshHistory) {
      historyQuotes = await fetchHistoryQuotes(DEFAULT_BTC_HISTORY_DAYS);
      if (historyQuotes.length === 0) {
        throw new Error("Btc market history provider returned no data points");
      }
    }

    await repository.saveCurrentBtcPrice({
      priceUsd: currentPriceQuote.priceUsd,
      source: currentPriceQuote.source,
      updatedAtMs: nowMs,
    });

    if (!shouldRefreshHistory || historyQuotes === null) {
      return outputSchema.parse({
        success: true,
        currentPriceUpdated: true,
        historyRefreshed: false,
        historyPointsSaved: 0,
      });
    }

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

  return nowMs - latestHistoryUpdatedAtMs >= HISTORY_REFRESH_INTERVAL_6_HOURS_MS;
}

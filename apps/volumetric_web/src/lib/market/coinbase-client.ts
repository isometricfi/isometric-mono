import "server-only";

import { z } from "zod";

const COINBASE_EXCHANGE_BASE_URL = "https://api.exchange.coinbase.com";
const BTC_USD_PRODUCT_ID = "BTC-USD";
const COINBASE_EXCHANGE_SOURCE = "coinbase_exchange" as const;
const COINBASE_1_HOUR_CANDLE_GRANULARITY_SECONDS = 3_600;
const COINBASE_MAX_CANDLES_PER_REQUEST = 300;
const COINBASE_CANDLES_PER_REQUEST_WITH_MARGIN = 250;
const MILLISECONDS_PER_SECOND = 1_000;
const SECONDS_PER_DAY = 86_400;
const COINBASE_REQUEST_CACHE: RequestCache = "no-store";
const COINBASE_REQUEST_HEADERS: HeadersInit = {
  Accept: "application/json",
  "User-Agent": "volumetric-web/1.0 (btc-market-sync)",
};
const COINBASE_ERROR_BODY_MAX_CHARS = 500;

const coinbaseTickerResponseSchema = z.object({
  price: z.coerce.number().positive(),
});

const coinbaseCandleResponseSchema = z.array(
  z.tuple([
    z.number().int().positive(),
    z.number().positive(),
    z.number().positive(),
    z.number().positive(),
    z.number().positive(),
    z.number().nonnegative(),
  ]),
);

export interface BtcCurrentPriceQuote {
  priceUsd: number;
  source: typeof COINBASE_EXCHANGE_SOURCE;
}

export interface BtcHistoryQuote {
  timestampMs: number;
  priceUsd: number;
  source: typeof COINBASE_EXCHANGE_SOURCE;
}

export async function fetchCurrentBtcPriceQuote(
  fetchFn: typeof fetch = fetch,
): Promise<BtcCurrentPriceQuote> {
  const url = new URL(`${COINBASE_EXCHANGE_BASE_URL}/products/${BTC_USD_PRODUCT_ID}/ticker`);

  const data = coinbaseTickerResponseSchema.parse(await fetchJson(fetchFn, url));

  return {
    priceUsd: data.price,
    source: COINBASE_EXCHANGE_SOURCE,
  };
}

export async function fetchBtcHistoryQuotes(
  days: number,
  fetchFn: typeof fetch = fetch,
): Promise<BtcHistoryQuote[]> {
  const endSeconds = Math.floor(Date.now() / MILLISECONDS_PER_SECOND);
  const startSeconds = endSeconds - days * SECONDS_PER_DAY;
  const windows = buildCandleRequestWindowsSeconds(startSeconds, endSeconds);

  const quotesByTimestampMs = new Map<number, BtcHistoryQuote>();
  for (const window of windows) {
    const candles = await fetchCandleWindow(fetchFn, window);
    for (const [timestampSeconds, _low, _high, _open, close] of candles) {
      const timestampMs = timestampSeconds * MILLISECONDS_PER_SECOND;
      quotesByTimestampMs.set(timestampMs, {
        timestampMs,
        priceUsd: close,
        source: COINBASE_EXCHANGE_SOURCE,
      });
    }
  }

  return Array.from(quotesByTimestampMs.values()).sort(
    (left, right) => left.timestampMs - right.timestampMs,
  );
}

interface CandleRequestWindowSeconds {
  startSeconds: number;
  endSeconds: number;
}

function buildCandleRequestWindowsSeconds(
  startSeconds: number,
  endSeconds: number,
): CandleRequestWindowSeconds[] {
  const windowSpanSeconds =
    COINBASE_CANDLES_PER_REQUEST_WITH_MARGIN * COINBASE_1_HOUR_CANDLE_GRANULARITY_SECONDS;

  const windows: CandleRequestWindowSeconds[] = [];
  let cursorSeconds = startSeconds;
  while (cursorSeconds < endSeconds) {
    const windowEndSeconds = Math.min(cursorSeconds + windowSpanSeconds, endSeconds);
    windows.push({ startSeconds: cursorSeconds, endSeconds: windowEndSeconds });
    cursorSeconds = windowEndSeconds;
  }
  return windows;
}

async function fetchCandleWindow(
  fetchFn: typeof fetch,
  window: CandleRequestWindowSeconds,
): Promise<Array<[number, number, number, number, number, number]>> {
  const url = new URL(`${COINBASE_EXCHANGE_BASE_URL}/products/${BTC_USD_PRODUCT_ID}/candles`);
  url.searchParams.set("granularity", String(COINBASE_1_HOUR_CANDLE_GRANULARITY_SECONDS));
  url.searchParams.set("start", String(window.startSeconds));
  url.searchParams.set("end", String(window.endSeconds));

  const candles = coinbaseCandleResponseSchema.parse(await fetchJson(fetchFn, url));
  if (candles.length > COINBASE_MAX_CANDLES_PER_REQUEST) {
    throw new Error(
      `Coinbase returned ${candles.length} candles, exceeding per-request max of ${COINBASE_MAX_CANDLES_PER_REQUEST}`,
    );
  }
  return candles;
}

async function fetchJson(fetchFn: typeof fetch, url: URL): Promise<unknown> {
  const response = await fetchFn(url, {
    cache: COINBASE_REQUEST_CACHE,
    headers: COINBASE_REQUEST_HEADERS,
  });

  if (!response.ok) {
    const errorBody = await response.text();
    const truncatedErrorBody =
      errorBody.length > COINBASE_ERROR_BODY_MAX_CHARS
        ? `${errorBody.slice(0, COINBASE_ERROR_BODY_MAX_CHARS)}…`
        : errorBody;
    const errorSuffix = truncatedErrorBody.length > 0 ? `: ${truncatedErrorBody}` : "";
    throw new Error(`Coinbase request failed with status ${response.status}${errorSuffix}`);
  }

  return response.json();
}

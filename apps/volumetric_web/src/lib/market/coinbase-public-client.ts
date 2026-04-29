import { z } from "zod";

const COINBASE_EXCHANGE_BASE_URL = "https://api.exchange.coinbase.com";
const BTC_USD_PRODUCT_ID = "BTC-USD";
const COINBASE_1_HOUR_CANDLE_GRANULARITY_SECONDS = 3_600;
const COINBASE_MAX_CANDLES_PER_REQUEST = 300;
const COINBASE_CANDLES_PER_REQUEST_WITH_MARGIN = 250;
const MILLISECONDS_PER_SECOND = 1_000;
const SECONDS_PER_DAY = 86_400;
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

export interface BtcCurrentPrice {
  priceUsd: number;
}

export interface BtcHistoryPoint {
  timestampMs: number;
  priceUsd: number;
}

export async function fetchCurrentBtcPrice(): Promise<BtcCurrentPrice> {
  const url = new URL(`${COINBASE_EXCHANGE_BASE_URL}/products/${BTC_USD_PRODUCT_ID}/ticker`);
  const data = coinbaseTickerResponseSchema.parse(await fetchJson(url));
  return { priceUsd: data.price };
}

export async function fetchBtcHistory(days: number): Promise<BtcHistoryPoint[]> {
  const endSeconds = Math.floor(Date.now() / MILLISECONDS_PER_SECOND);
  const startSeconds = endSeconds - days * SECONDS_PER_DAY;
  const windows = buildCandleRequestWindowsSeconds(startSeconds, endSeconds);

  const candles = await Promise.all(windows.map((window) => fetchCandleWindow(window)));
  for (const windowCandles of candles) {
    for (const [timestampSeconds, _low, _high, _open, close] of windowCandles) {
      const timestampMs = timestampSeconds * MILLISECONDS_PER_SECOND;
      pointsByTimestampMs.set(timestampMs, { timestampMs, priceUsd: close });
    }
  }

  return Array.from(pointsByTimestampMs.values()).sort(
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
  window: CandleRequestWindowSeconds,
): Promise<Array<[number, number, number, number, number, number]>> {
  const url = new URL(`${COINBASE_EXCHANGE_BASE_URL}/products/${BTC_USD_PRODUCT_ID}/candles`);
  url.searchParams.set("granularity", String(COINBASE_1_HOUR_CANDLE_GRANULARITY_SECONDS));
  url.searchParams.set("start", String(window.startSeconds));
  url.searchParams.set("end", String(window.endSeconds));

  const candles = coinbaseCandleResponseSchema.parse(await fetchJson(url));
  if (candles.length > COINBASE_MAX_CANDLES_PER_REQUEST) {
    throw new Error(
      `Coinbase returned ${candles.length} candles, exceeding per-request max of ${COINBASE_MAX_CANDLES_PER_REQUEST}`,
    );
  }
  return candles;
}

async function fetchJson(url: URL): Promise<unknown> {
  const response = await fetch(url, {
    headers: { Accept: "application/json" },
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

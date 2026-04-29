import "server-only";

import { z } from "zod";

const COINGECKO_BASE_URL = "https://api.coingecko.com/api/v3";
const BITCOIN_COIN_ID = "bitcoin";
const USD_CURRENCY = "usd";
const COINGECKO_SOURCE = "coingecko";

const coingeckoSimplePriceResponseSchema = z.object({
  bitcoin: z.object({
    usd: z.number().positive(),
  }),
});

const coingeckoMarketChartResponseSchema = z.object({
  prices: z.array(z.tuple([z.number().int().positive(), z.number().positive()])),
});

export interface BtcCurrentPriceQuote {
  priceUsd: number;
  source: typeof COINGECKO_SOURCE;
}

export interface BtcHistoryQuote {
  timestampMs: number;
  priceUsd: number;
  source: typeof COINGECKO_SOURCE;
}

export async function fetchCurrentBtcPriceQuote(
  fetchFn: typeof fetch = fetch,
): Promise<BtcCurrentPriceQuote> {
  const url = new URL(`${COINGECKO_BASE_URL}/simple/price`);
  url.searchParams.set("ids", BITCOIN_COIN_ID);
  url.searchParams.set("vs_currencies", USD_CURRENCY);

  const data = coingeckoSimplePriceResponseSchema.parse(await fetchJson(fetchFn, url));

  return {
    priceUsd: data.bitcoin.usd,
    source: COINGECKO_SOURCE,
  };
}

export async function fetchBtcHistoryQuotes(
  days: number,
  fetchFn: typeof fetch = fetch,
): Promise<BtcHistoryQuote[]> {
  const url = new URL(`${COINGECKO_BASE_URL}/coins/${BITCOIN_COIN_ID}/market_chart`);
  url.searchParams.set("vs_currency", USD_CURRENCY);
  url.searchParams.set("days", String(days));

  const data = coingeckoMarketChartResponseSchema.parse(await fetchJson(fetchFn, url));

  return data.prices.map(([timestampMs, priceUsd]) => ({
    timestampMs,
    priceUsd,
    source: COINGECKO_SOURCE,
  }));
}

async function fetchJson(fetchFn: typeof fetch, url: URL): Promise<unknown> {
  const response = await fetchFn(url, {
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`CoinGecko request failed with status ${response.status}`);
  }

  return response.json();
}

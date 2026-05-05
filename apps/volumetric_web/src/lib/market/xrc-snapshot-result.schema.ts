import type { Result_6 } from "@volumetric/canister-types";
import { z } from "zod";

const bigintField = z.union([
  z.bigint(),
  z
    .string()
    .regex(/^\d+$/)
    .transform((s) => BigInt(s)),
]);

const assetClassSchema = z.union([
  z.object({ Cryptocurrency: z.null() }),
  z.object({ FiatCurrency: z.null() }),
]);

const asset1Schema = z.object({
  class: assetClassSchema,
  symbol: z.string(),
});

const exchangeRateMetadataSchema = z.object({
  decimals: z.number(),
  forex_timestamp: z.union([z.tuple([]), z.tuple([bigintField])]),
  quote_asset_num_received_rates: bigintField,
  base_asset_num_received_rates: bigintField,
  base_asset_num_queried_sources: bigintField,
  standard_deviation: bigintField,
  quote_asset_num_queried_sources: bigintField,
});

const exchangeRateSchema = z.object({
  metadata: exchangeRateMetadataSchema,
  rate: bigintField,
  timestamp: bigintField,
  quote_asset: asset1Schema,
  base_asset: asset1Schema,
});

const exchangeRateErrorSchema = z.union([
  z.object({ AnonymousPrincipalNotAllowed: z.null() }),
  z.object({ CryptoQuoteAssetNotFound: z.null() }),
  z.object({ FailedToAcceptCycles: z.null() }),
  z.object({ ForexBaseAssetNotFound: z.null() }),
  z.object({ CryptoBaseAssetNotFound: z.null() }),
  z.object({ StablecoinRateTooFewRates: z.null() }),
  z.object({ ForexAssetsNotFound: z.null() }),
  z.object({ InconsistentRatesReceived: z.null() }),
  z.object({ RateLimited: z.null() }),
  z.object({ StablecoinRateZeroRate: z.null() }),
  z.object({
    Other: z.object({
      code: z.number(),
      description: z.string(),
    }),
  }),
  z.object({ ForexInvalidTimestamp: z.null() }),
  z.object({ NotEnoughCycles: z.null() }),
  z.object({ ForexQuoteAssetNotFound: z.null() }),
  z.object({ StablecoinRateNotFound: z.null() }),
  z.object({ Pending: z.null() }),
]);

export const xrcGetExchangeRateResultSchema = z.union([
  z.object({ Ok: exchangeRateSchema }),
  z.object({ Err: exchangeRateErrorSchema }),
]);

export function stringifyXrcSnapshotResult(result: Result_6): string {
  return JSON.stringify(result, (_key, value) =>
    typeof value === "bigint" ? value.toString() : value,
  );
}

export function parseXrcSnapshotResultJson(jsonText: string): Result_6 {
  const parsed: unknown = JSON.parse(jsonText);
  return xrcGetExchangeRateResultSchema.parse(parsed) as Result_6;
}

import { z } from "zod";
import { MAX_BTC_HISTORY_DAYS, MIN_BTC_HISTORY_DAYS } from "@/lib/market/btc-history-limits";

export const inputSchema = z.object({
  days: z.number().int().min(MIN_BTC_HISTORY_DAYS).max(MAX_BTC_HISTORY_DAYS),
});

export const btcHistoryPointSchema = z.object({
  timestamp: z.number(),
  price: z.number(),
});

export const outputSchema = z.array(btcHistoryPointSchema);

export type Input = z.infer<typeof inputSchema>;
export type BtcHistoryPoint = z.infer<typeof btcHistoryPointSchema>;
export type Output = z.infer<typeof outputSchema>;

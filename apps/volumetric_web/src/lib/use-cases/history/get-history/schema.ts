import { z } from "zod";

export const inputSchema = z.object({
  principal: z.string().min(1),
});

export type Input = z.infer<typeof inputSchema>;

export type TradeRole = "buyer" | "writer";
export type OptionType = "call" | "put";
export type TradeResult = "profit" | "loss" | "breakeven";
export type MoneyStatus = "itm" | "otm" | "atm";

export interface HistoryEntry {
  id: string;
  role: TradeRole;
  optionType: OptionType;
  quantitySats: bigint;
  strikePriceCents: bigint;
  entryPriceCents: bigint;
  settlementPriceCents: bigint;
  premiumSats: bigint;
  payoutSats: bigint;
  pnlSats: bigint;
  pnlPercent: number;
  result: TradeResult;
  moneyStatus: MoneyStatus;
  acceptedAt: bigint;
  settledAt: bigint;
}

export interface Output {
  entries: HistoryEntry[];
}

import { getEventsRepository } from "@/lib/repositories/events/get-events-repository";
import type { HistoryEntry, MoneyStatus, Output, TradeResult, TradeRole } from "./schema";

const ZERO = BigInt(0);

function calculatePnl(
  role: TradeRole,
  premiumSats: bigint,
  payoutSats: bigint,
  quantitySats: bigint,
): bigint {
  if (role === "buyer") {
    // Buyer pays premium upfront, receives payout at settlement
    return payoutSats - premiumSats;
  } else {
    // Writer receives premium upfront, but locks quantity as collateral
    // Payout is their remaining collateral + premium
    // PnL = payout - quantity (their initial collateral)
    // Which equals: premium - (what they paid to buyer)
    return payoutSats - quantitySats;
  }
}

function calculatePnlPercent(
  role: TradeRole,
  pnlSats: bigint,
  premiumSats: bigint,
  quantitySats: bigint,
): number {
  if (role === "buyer") {
    // For buyers, PnL % is relative to premium paid
    return premiumSats > ZERO ? (Number(pnlSats) / Number(premiumSats)) * 100 : 0;
  } else {
    // For writers, PnL % is relative to collateral locked
    return quantitySats > ZERO ? (Number(pnlSats) / Number(quantitySats)) * 100 : 0;
  }
}

function getTradeResult(pnlSats: bigint): TradeResult {
  if (pnlSats > ZERO) return "profit";
  if (pnlSats < ZERO) return "loss";
  return "breakeven";
}

function getMoneyStatus(strikePriceCents: bigint, settlementPriceCents: bigint): MoneyStatus {
  const threshold = Number(strikePriceCents) * 0.01;
  const diff = Math.abs(Number(settlementPriceCents) - Number(strikePriceCents));

  if (diff < threshold) return "atm";
  if (settlementPriceCents > strikePriceCents) return "itm";
  return "otm";
}

export async function getHistory(principal: string): Promise<Output> {
  const repository = getEventsRepository();

  // Get all events for the principal, we'll filter to OptionSettled
  const events = await repository.getEventsByPrincipal(principal, { limit: 1000 });

  const entries: HistoryEntry[] = [];

  for (const event of events) {
    if (event.data.type !== "OptionSettled") continue;

    const data = event.data;
    const role: TradeRole = data.role === "Buyer" ? "buyer" : "writer";
    const quantitySats = BigInt(data.quantitySats);
    const premiumSats = BigInt(data.premiumSats);
    const payoutSats = BigInt(data.payoutSats);
    const strikePriceCents = BigInt(data.strikePriceCents);
    const entryPriceCents = BigInt(data.entryPriceCents);
    const settlementPriceCents = BigInt(data.settlementPriceCents);

    const pnlSats = calculatePnl(role, premiumSats, payoutSats, quantitySats);
    const pnlPercent = calculatePnlPercent(role, pnlSats, premiumSats, quantitySats);

    entries.push({
      id: `${event.id}-${data.optionId}`,
      role,
      optionType: "call", // Currently only calls are supported
      quantitySats,
      strikePriceCents,
      entryPriceCents,
      settlementPriceCents,
      premiumSats,
      payoutSats,
      pnlSats,
      pnlPercent,
      result: getTradeResult(pnlSats),
      moneyStatus: getMoneyStatus(strikePriceCents, settlementPriceCents),
      acceptedAt: BigInt(data.acceptedAtNs),
      settledAt: BigInt(data.settledAtNs),
    });
  }

  // Sort by settlement time, most recent first
  entries.sort((a, b) => Number(b.settledAt - a.settledAt));

  return { entries };
}

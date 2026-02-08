import type { MoneyStatus, TradeResult, TradeRole } from "./schema";

const ZERO = BigInt(0);

export function calculatePnl(
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

export function calculatePnlPercent(
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

export function getTradeResult(pnlSats: bigint): TradeResult {
  if (pnlSats > ZERO) return "profit";
  if (pnlSats < ZERO) return "loss";
  return "breakeven";
}

export function getMoneyStatus(
  strikePriceCents: bigint,
  settlementPriceCents: bigint,
): MoneyStatus {
  const threshold = Number(strikePriceCents) * 0.01;
  const diff = Math.abs(Number(settlementPriceCents) - Number(strikePriceCents));

  if (diff < threshold) return "atm";
  if (settlementPriceCents > strikePriceCents) return "itm";
  return "otm";
}

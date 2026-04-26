import { intervalToDuration, isPast } from "date-fns";
import { useTranslations } from "next-intl";
import { type PortfolioOption, useConfig } from "@/hooks";
import { SATS_PER_BTC } from "@/lib/utils";
import type { ViewerMode } from "@/types/ui";

interface PnL {
  valueBtc: number;
  valueUsd: number;
  percent: number;
  isProfit: boolean;
}

interface TimeRemaining {
  text: string;
  isExpired: boolean;
  progressPercent: number;
  expiryDate: Date;
}

export interface OptionCardData {
  pnl: PnL | null;
  timeRemaining: TimeRemaining;
  strikePrice: number;
  entryPrice: number;
  premiumBtc: number;
  breakEvenPrice: number | null;
  priceToBreakEven: number | null;
}

function netPremiumSatsForRole(
  premiumSats: number,
  premiumFeeBps: number,
  role: ViewerMode,
): number {
  if (role !== "writer" || premiumFeeBps <= 0) return premiumSats;
  const feeSats = Math.floor((premiumSats * premiumFeeBps) / 10_000);
  return premiumSats - feeSats;
}

function calculatePnL(
  option: PortfolioOption,
  currentPrice: number,
  role: ViewerMode,
  premiumFeeBps: number,
): PnL | null {
  if (currentPrice <= 0) return null;

  const strikePriceCents = Number(option.strikePriceCents);
  const premiumSats = netPremiumSatsForRole(Number(option.premiumPaid), premiumFeeBps, role);
  const quantitySats = Number(option.quantity);

  const strikePriceUsd = strikePriceCents / 100;
  const premiumBtc = premiumSats / SATS_PER_BTC;
  const premiumUsd = premiumBtc * currentPrice;
  const quantityBtc = quantitySats / SATS_PER_BTC;
  const payoutBtc =
    currentPrice > strikePriceUsd
      ? (quantityBtc * (currentPrice - strikePriceUsd)) / currentPrice
      : 0;
  const payoutUsd = payoutBtc * currentPrice;
  const quantityUsd = quantityBtc * currentPrice;
  const netPnLBtc = role === "buyer" ? payoutBtc - premiumBtc : premiumBtc - payoutBtc;
  const netPnLUsd = role === "buyer" ? payoutUsd - premiumUsd : premiumUsd - payoutUsd;
  const percentDenominatorUsd = role === "buyer" ? premiumUsd : quantityUsd;
  const percent = percentDenominatorUsd > 0 ? (netPnLUsd / percentDenominatorUsd) * 100 : 0;

  return {
    valueBtc: netPnLBtc,
    valueUsd: netPnLUsd,
    percent,
    isProfit: netPnLUsd > 0,
  };
}

function getTimeRemaining(
  expirySeconds: bigint,
  acceptedAtSeconds: bigint,
  t: (key: string) => string,
): TimeRemaining {
  const expiryMs = Number(expirySeconds) * 1_000;
  const acceptedAtMs = Number(acceptedAtSeconds) * 1_000;
  const expiryDate = new Date(expiryMs);
  const now = Date.now();

  const totalDuration = expiryMs - acceptedAtMs;
  const elapsed = now - acceptedAtMs;
  const progressPercent = Math.min(100, Math.max(0, (elapsed / totalDuration) * 100));

  if (isPast(expiryDate)) {
    return {
      text: t("expired"),
      isExpired: true,
      progressPercent: 100,
      expiryDate,
    };
  }

  const duration = intervalToDuration({
    start: new Date(),
    end: expiryDate,
  });

  const parts: string[] = [];

  if (duration.days && duration.days > 0) {
    parts.push(`${duration.days}d`);
    if (duration.hours && duration.hours > 0) {
      parts.push(`${duration.hours}h`);
    }
  } else if (duration.hours && duration.hours > 0) {
    parts.push(`${duration.hours}h`);
    if (duration.minutes && duration.minutes > 0) {
      parts.push(`${duration.minutes}m`);
    }
  } else if (duration.minutes && duration.minutes > 0) {
    parts.push(`${duration.minutes}m`);
  } else {
    parts.push("<1m");
  }

  return {
    text: parts.join(" "),
    isExpired: false,
    progressPercent,
    expiryDate,
  };
}

export function useOptionCardData(
  option: PortfolioOption,
  btcPrice: number,
  role: ViewerMode,
): OptionCardData {
  const t = useTranslations("OptionCard");
  const { data: config } = useConfig();
  const premiumFeeBps = Number(config?.fees.premiumFeeBasisPoints ?? BigInt(0));

  const timeRemaining = getTimeRemaining(option.expiry, option.acceptedAt, t);
  const pnl = calculatePnL(option, btcPrice, role, premiumFeeBps);

  const strikePrice = Number(option.strikePriceCents) / 100;
  const entryPrice = Number(option.entryPriceCents) / 100;
  const premiumBtc =
    netPremiumSatsForRole(Number(option.premiumPaid), premiumFeeBps, role) / SATS_PER_BTC;
  const quantityBtc = Number(option.quantity) / SATS_PER_BTC;

  const premiumToQuantityRatio = quantityBtc > 0 ? premiumBtc / quantityBtc : 0;
  const breakEvenPrice =
    role === "buyer" && quantityBtc > premiumBtc
      ? strikePrice / (1 - premiumToQuantityRatio)
      : null;

  const priceToBreakEven =
    breakEvenPrice !== null && btcPrice > 0 ? ((breakEvenPrice - btcPrice) / btcPrice) * 100 : null;

  return {
    pnl,
    timeRemaining,
    strikePrice,
    entryPrice,
    premiumBtc,
    breakEvenPrice,
    priceToBreakEven,
  };
}

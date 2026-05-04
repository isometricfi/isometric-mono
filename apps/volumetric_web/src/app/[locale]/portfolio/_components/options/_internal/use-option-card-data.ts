import { intervalToDuration, isPast } from "date-fns";
import { useTranslations } from "next-intl";
import { type PortfolioOption, useConfig } from "@/hooks";
import { SATS_PER_BTC } from "@/lib/utils";
import type { ViewerMode } from "@/types/ui";

interface PnL {
  valueSats: bigint;
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
  premiumSats: bigint;
  breakEvenPrice: number | null;
  priceToBreakEven: number | null;
}

const ZERO_SATS = BigInt(0);
const BASIS_POINTS_DENOMINATOR = BigInt(10_000);

function netPremiumSatsForRole(
  premiumSats: bigint,
  premiumFeeBps: bigint,
  role: ViewerMode,
): bigint {
  if (role !== "writer" || premiumFeeBps <= ZERO_SATS) return premiumSats;
  const feeSats = (premiumSats * premiumFeeBps) / BASIS_POINTS_DENOMINATOR;
  return premiumSats - feeSats;
}

function calculatePnL(
  option: PortfolioOption,
  currentPrice: number,
  role: ViewerMode,
  premiumFeeBps: bigint,
): PnL | null {
  if (currentPrice <= 0) return null;

  const strikePriceUsd = Number(option.strikePriceCents) / 100;
  const premiumSats = netPremiumSatsForRole(option.premiumPaid, premiumFeeBps, role);
  const quantitySats = option.quantity;

  const payoutRatio =
    currentPrice > strikePriceUsd ? (currentPrice - strikePriceUsd) / currentPrice : 0;
  const payoutSats = BigInt(Math.round(Number(quantitySats) * payoutRatio));

  const pnlSats = role === "buyer" ? payoutSats - premiumSats : premiumSats - payoutSats;
  const pnlUsd = (Number(pnlSats) / SATS_PER_BTC) * currentPrice;

  const denominatorSats = role === "buyer" ? premiumSats : quantitySats;
  const denominatorUsd = (Number(denominatorSats) / SATS_PER_BTC) * currentPrice;
  const percent = denominatorUsd > 0 ? (pnlUsd / denominatorUsd) * 100 : 0;

  return {
    valueSats: pnlSats,
    valueUsd: pnlUsd,
    percent,
    isProfit: pnlSats > ZERO_SATS,
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
  const premiumFeeBps = config?.fees.premiumFeeBasisPoints ?? ZERO_SATS;

  const timeRemaining = getTimeRemaining(option.expiry, option.acceptedAt, t);
  const pnl = calculatePnL(option, btcPrice, role, premiumFeeBps);

  const strikePrice = Number(option.strikePriceCents) / 100;
  const entryPrice = Number(option.entryPriceCents) / 100;
  const premiumSats = netPremiumSatsForRole(option.premiumPaid, premiumFeeBps, role);
  const premiumBtc = Number(premiumSats) / SATS_PER_BTC;
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
    premiumSats,
    breakEvenPrice,
    priceToBreakEven,
  };
}

import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const SATS_PER_BTC = 100_000_000;
export const SATS_PER_BTC_BIGINT = BigInt(100_000_000);

// Fallback values while config is loading. These should match canister defaults.
export const DEFAULT_MIN_DEPOSIT_SATS = 50_000;
export const DEFAULT_MIN_WITHDRAW_SATS = 50_000;
export const DEFAULT_MIN_CREATE_OFFER_AMOUNT_SATS = 90_000;
export const DEFAULT_MAX_CREATE_OFFER_AMOUNT_SATS = 100_000_000;
export const DEFAULT_MIN_ACCEPT_OFFER_AMOUNT_SATS = 90_000;
export const DEFAULT_MAX_ACCEPT_OFFER_AMOUNT_SATS = 100_000_000;

export function satsToBtc(sats: number): number {
  return sats / SATS_PER_BTC;
}

export function btcToSats(btc: number): number {
  return Math.round(btc * SATS_PER_BTC);
}

export function formatBtc(sats: number, maxDecimals = 8): string {
  const btc = satsToBtc(sats);
  return parseFloat(btc.toFixed(maxDecimals)).toString();
}

export function formatBtcWithSymbol(sats: number, maxDecimals = 8): string {
  return `₿${formatBtc(sats, maxDecimals)}`;
}

export function parseBtcToSats(btcString: string): number {
  const btc = parseFloat(btcString);
  if (Number.isNaN(btc)) return 0;
  return btcToSats(btc);
}

export function roundToN(value: number, decimals = 2): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

export function formatBtcBigint(sats: bigint, maxDecimals = 8): string {
  const isNegative = sats < BigInt(0);
  const absSats = isNegative ? -sats : sats;

  const whole = absSats / SATS_PER_BTC_BIGINT;
  const fraction = absSats % SATS_PER_BTC_BIGINT;

  const decimals = Math.min(Math.max(maxDecimals, 0), 8);
  if (decimals === 0) {
    return `${isNegative ? "-" : ""}${whole.toString()}`;
  }

  const fractionPadded = fraction.toString().padStart(8, "0").slice(0, decimals);
  const fractionTrimmed = fractionPadded.replace(/0+$/, "");

  const value = fractionTrimmed ? `${whole.toString()}.${fractionTrimmed}` : whole.toString();
  return isNegative ? `-${value}` : value;
}

export function formatBtcWithSymbolBigint(sats: bigint, maxDecimals = 8): string {
  const isNegative = sats < BigInt(0);
  const absSats = isNegative ? -sats : sats;
  return `${isNegative ? "-" : ""}₿${formatBtcBigint(absSats, maxDecimals)}`;
}

export function parseBtcToSatsBigint(btcString: string): bigint {
  const input = btcString.trim();
  if (!input) return BigInt(0);
  if (!/^\d*\.?\d*$/.test(input)) return BigInt(0);

  const [wholeRaw, fractionRaw = ""] = input.split(".");
  const whole = wholeRaw ? BigInt(wholeRaw) : BigInt(0);
  const fractionPadded = fractionRaw.slice(0, 8).padEnd(8, "0");
  const fraction = fractionPadded ? BigInt(fractionPadded) : BigInt(0);

  return whole * SATS_PER_BTC_BIGINT + fraction;
}

const SECONDS_PER_DAY = 86400;
const MS_PER_SECOND = 1_000;
const BASIS_POINTS_DIVISOR = 100;
const FALLBACK_USERNAME_MODULUS = 10_000;
const FALLBACK_USERNAME_PAD = 4;

export function secondsToDays(seconds: bigint): number {
  const days = Number(seconds) / SECONDS_PER_DAY;
  if (days < 1) return 1;
  return Math.round(days);
}

export function secondsToISOString(seconds: bigint): string {
  return new Date(Number(seconds) * MS_PER_SECOND).toISOString();
}

export function basisPointsToPercent(basisPoints: number): number {
  return basisPoints / BASIS_POINTS_DIVISOR;
}

export function generateUserTag(identifier: string): string {
  const source = identifier.trim();
  if (!source) return "0000";

  let hash = 0;
  for (const character of source) {
    hash = (hash * 31 + character.charCodeAt(0)) % FALLBACK_USERNAME_MODULUS;
  }

  return hash.toString().padStart(FALLBACK_USERNAME_PAD, "0");
}

export function getFallbackUsername(identifier: string, locale?: string): string {
  const tag = generateUserTag(identifier);
  return locale === "zh" ? `用户 ${tag}` : `User ${tag}`;
}

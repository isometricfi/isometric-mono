import Big from "big.js";
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const SATS_PER_BTC = BigInt(100_000_000);
export const CENTS_PER_DOLLAR = 100;

export function satsToBtc(sats: bigint): Big {
  return new Big(sats.toString()).div(SATS_PER_BTC.toString());
}

export function centsToUsd(cents: bigint): number {
  return Number(cents) / CENTS_PER_DOLLAR;
}

export function formatUsd(cents: bigint): string {
  return centsToUsd(cents).toLocaleString();
}

export function btcToSats(btc: string | number | Big): bigint {
  const btcBig = btc instanceof Big ? btc : new Big(btc.toString());
  return BigInt(btcBig.times(SATS_PER_BTC.toString()).round(0, Big.roundDown).toString());
}

export function formatBtc(sats: bigint, maxDecimals = 8): string {
  const isNegative = sats < BigInt(0);
  const absSats = isNegative ? -sats : sats;

  const whole = absSats / SATS_PER_BTC;
  const fraction = absSats % SATS_PER_BTC;

  const decimals = Math.min(Math.max(maxDecimals, 0), 8);
  if (decimals === 0) {
    return `${isNegative ? "-" : ""}${whole.toString()}`;
  }

  const fractionPadded = fraction.toString().padStart(8, "0").slice(0, decimals);
  const fractionTrimmed = fractionPadded.replace(/0+$/, "");

  const value = fractionTrimmed ? `${whole.toString()}.${fractionTrimmed}` : whole.toString();
  return isNegative ? `-${value}` : value;
}

export function formatBtcWithSymbol(sats: bigint, maxDecimals = 8): string {
  return `₿${formatBtc(sats, maxDecimals)}`;
}

export function parseBtcToSats(btcString: string): bigint {
  const input = btcString.trim();
  if (!input) return BigInt(0);
  if (!/^\d*\.?\d*$/.test(input)) return BigInt(0);

  const [wholeRaw, fractionRaw = ""] = input.split(".");
  const whole = wholeRaw ? BigInt(wholeRaw) : BigInt(0);
  const fractionPadded = fractionRaw.slice(0, 8).padEnd(8, "0");
  const fraction = fractionPadded ? BigInt(fractionPadded) : BigInt(0);

  return whole * SATS_PER_BTC + fraction;
}

export function roundToN(value: number, decimals = 2): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

export function multiplySats(sats: bigint, multiplier: number): bigint {
  const result = new Big(sats.toString()).times(multiplier);
  return BigInt(result.round(0, Big.roundDown).toString());
}

export function divideSats(sats: bigint, divisor: number): bigint {
  const result = new Big(sats.toString()).div(divisor);
  return BigInt(result.round(0, Big.roundDown).toString());
}

const SECONDS_PER_DAY = 86400;
const NS_PER_MS = BigInt(1_000_000);
const MS_PER_NS = BigInt(1_000_000);
const BASIS_POINTS_DIVISOR = 100;

export function secondsToDays(seconds: bigint): number {
  const days = Number(seconds) / SECONDS_PER_DAY;
  if (days < 1) return 1;
  return Math.round(days);
}

export function nsToMs(ns: bigint): number {
  return Number(ns / NS_PER_MS);
}

export function msToNs(ms: number): bigint {
  return BigInt(ms) * MS_PER_NS;
}

export function nsToDate(ns: bigint): Date {
  return new Date(nsToMs(ns));
}

export function nowNs(): bigint {
  return msToNs(Date.now());
}

export function nsToISOString(ns: bigint): string {
  return nsToDate(ns).toISOString();
}

export function basisPointsToPercent(basisPoints: number): number {
  return basisPoints / BASIS_POINTS_DIVISOR;
}

export function getErrorMessage(error: unknown, fallback = "An error occurred"): string {
  let message = fallback;

  if (error instanceof Error && error.message) {
    message = error.message;
  } else if (typeof error === "string" && error) {
    message = error;
  } else if (error && typeof error === "object" && "message" in error) {
    const msg = (error as { message: unknown }).message;
    if (typeof msg === "string" && msg) {
      message = msg;
    }
  }

  return message;
}

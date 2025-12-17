import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const SATS_PER_BTC = 100_000_000;

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
  return `₿ ${formatBtc(sats, maxDecimals)}`;
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

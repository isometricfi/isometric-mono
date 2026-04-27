import { btcToSats } from "@/lib/utils";

const MAX_BTC_INPUT = 100;
const MAX_BTC_DECIMALS = 6;
const MAX_USD_INPUT = 10_000_000;
const MAX_USD_DECIMALS = 2;

export function sanitizeBtcInput(input: string): string | null {
  return sanitizeDecimalInput(input, {
    maxDecimals: MAX_BTC_DECIMALS,
    maxValueExclusive: MAX_BTC_INPUT,
  });
}

export function sanitizeUsdInput(input: string): string | null {
  return sanitizeDecimalInput(input, {
    maxDecimals: MAX_USD_DECIMALS,
    maxValueExclusive: MAX_USD_INPUT,
  });
}

export function formatUsdInputValue(usdAmount: number): string {
  if (!Number.isFinite(usdAmount) || usdAmount <= 0) return "";
  return Number(usdAmount.toFixed(MAX_USD_DECIMALS)).toString();
}

export function parseUsdInputToSats(usdAmountInput: string, btcPrice: number): number {
  const usdAmount = parseFloat(usdAmountInput);
  if (Number.isNaN(usdAmount) || usdAmount <= 0 || btcPrice <= 0) return 0;

  return btcToSats(usdAmount / btcPrice);
}

export function getStrikeUsd(btcPrice: number, strikePercent: number): number {
  return Math.round(btcPrice * (1 + strikePercent / 100));
}

export function getStrikeUsdValues(strikePercents: number[], btcPrice: number): number[] {
  return strikePercents.map((percent) => getStrikeUsd(btcPrice, percent));
}

export function getSortedPositiveUniqueValues(values: number[] | undefined): number[] {
  return [...new Set(values ?? [])].filter((value) => value > 0).sort((a, b) => a - b);
}

function sanitizeDecimalInput(
  input: string,
  options: { maxDecimals: number; maxValueExclusive: number },
): string | null {
  if (input === "") return "";
  const normalized = input.replace(/,/g, ".");
  if (!/^\d*\.?\d*$/.test(normalized)) return null;
  input = normalized;

  let sanitizedInput = input;
  if (/^0\d+/.test(sanitizedInput) && !sanitizedInput.startsWith("0.")) {
    sanitizedInput = sanitizedInput.replace(/^0+/, "");
  }

  const parts = sanitizedInput.split(".");
  if (parts.length === 2 && parts[1].length > options.maxDecimals) {
    sanitizedInput = `${parts[0]}.${parts[1].slice(0, options.maxDecimals)}`;
  }

  const numericValue = parseFloat(sanitizedInput);
  if (!Number.isNaN(numericValue) && numericValue >= options.maxValueExclusive) {
    return null;
  }

  return sanitizedInput;
}

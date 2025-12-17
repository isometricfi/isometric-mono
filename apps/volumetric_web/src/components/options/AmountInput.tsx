"use client";

import type { ChangeEvent } from "react";
import { usePrices } from "@/hooks/usePrices";
import { formatBtc } from "@/lib/utils";
import { SlidingNumber } from "../ui/sliding-number";

const MAX_DECIMALS = 5;
const MAX_BTC_INPUT = 100;

export interface AmountInputProps {
  value: string; // BTC string for display/input
  onChange: (value: string) => void;
  symbol?: string;
  maxAmountSats?: number;
  minAmountSats?: number;
  onMaxClick?: () => void;
}

// sanitize and format BTC input
function sanitizeBtcInput(input: string): string | null {
  if (input === "") return "";

  if (!/^\d*\.?\d*$/.test(input)) return null;

  if (/^0\d+/.test(input) && !input.startsWith("0.")) {
    input = input.replace(/^0+/, "");
  }

  const parts = input.split(".");
  if (parts.length === 2 && parts[1].length > MAX_DECIMALS) {
    input = `${parts[0]}.${parts[1].slice(0, MAX_DECIMALS)}`;
  }

  const numValue = parseFloat(input);
  if (!Number.isNaN(numValue) && numValue >= MAX_BTC_INPUT) {
    return null;
  }

  return input;
}

export function AmountInput({
  value,
  onChange,
  symbol = "₿",
  maxAmountSats,
  minAmountSats: _minAmountSats,
  onMaxClick,
}: AmountInputProps) {
  const { data: priceData } = usePrices();
  const btcPrice = priceData?.btc ?? 0;

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const sanitized = sanitizeBtcInput(e.target.value);
    if (sanitized !== null) {
      onChange(sanitized);
    }
  };

  const showMax = maxAmountSats !== undefined && onMaxClick !== undefined;

  const amountBtc = parseFloat(value) || 0;
  const amountUsd = Math.round(amountBtc * btcPrice);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-foreground">Amount</p>
        {showMax && (
          <button
            type="button"
            onClick={onMaxClick}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Max: {formatBtc(maxAmountSats, 4)} BTC
          </button>
        )}
      </div>
      <div className="relative">
        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground">
          {symbol}
        </span>
        <input
          type="text"
          inputMode="decimal"
          value={value}
          onChange={handleChange}
          placeholder={"0"}
          className="w-full py-3 pl-10 pr-4 bg-secondary/50 rounded-full text-sm font-medium placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />

        <div className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground text-sm bg-muted px-2 py-1 rounded-full flex items-center">
          $
          <SlidingNumber value={amountUsd} />
        </div>
      </div>
    </div>
  );
}

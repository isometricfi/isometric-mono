"use client";

import { useTranslations } from "next-intl";
import type { ChangeEvent } from "react";
import { usePrices } from "@/hooks";
import { sanitizeBtcInput } from "@/lib/options-form";
import { formatBtcWithSymbol } from "@/lib/utils";
import { SlidingNumber } from "../ui/sliding-number";

export interface AmountInputProps {
  value: string; // BTC string for display/input
  onChange: (value: string) => void;
  symbol?: string;
  maxAmountSats?: number;
  minAmountSats?: number;
  onMaxClick?: () => void;
}

export function AmountInput({
  value,
  onChange,
  symbol = "₿",
  maxAmountSats,
  minAmountSats: _minAmountSats,
  onMaxClick,
}: AmountInputProps) {
  const t = useTranslations("Forms");
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
        <p className="text-sm font-medium text-foreground">{t("amount")}</p>
        {showMax && (
          <button
            type="button"
            onClick={onMaxClick}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            {t("max")}: {formatBtcWithSymbol(maxAmountSats, 6)}
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
          className="w-full py-3 pl-10 pr-4 bg-secondary/50 rounded-md text-base md:text-sm font-medium placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />

        <div className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground text-sm bg-muted px-2 py-1 rounded-sm flex items-center">
          $
          <SlidingNumber value={amountUsd} />
        </div>
      </div>
    </div>
  );
}

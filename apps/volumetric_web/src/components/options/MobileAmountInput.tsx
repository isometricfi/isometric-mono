"use client";

import { ChevronsUpDown } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useId, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  formatUsdInputValue,
  parseUsdInputToSats,
  sanitizeBtcInput,
  sanitizeUsdInput,
} from "@/lib/options-form";
import { cn, formatBtc, formatBtcWithSymbol, parseBtcToSats, satsToBtc } from "@/lib/utils";

type InputUnit = "btc" | "usd";

interface MobileAmountInputProps {
  eyebrow: string;
  amountSats: number;
  btcPrice: number;
  maxAmountSats: number;
  minAmountSats?: number;
  onAmountSatsChange: (amountSats: number) => void;
}

const PRESETS = [0.25, 0.5, 0.75, 1] as const;

export function MobileAmountInput({
  eyebrow,
  amountSats,
  btcPrice,
  maxAmountSats,
  minAmountSats,
  onAmountSatsChange,
}: MobileAmountInputProps) {
  const tForms = useTranslations("Forms");
  const tCommon = useTranslations("Common");
  const inputId = useId();

  const isBelowMin = amountSats > 0 && minAmountSats !== undefined && amountSats < minAmountSats;
  const isAboveMax = amountSats > maxAmountSats;
  const hasError = isBelowMin || isAboveMax;
  const [unit, setUnit] = useState<InputUnit>("btc");
  const [activeValue, setActiveValue] = useState("");

  const usdAmount = useMemo(() => {
    if (btcPrice <= 0) return 0;
    return satsToBtc(amountSats) * btcPrice;
  }, [amountSats, btcPrice]);

  useEffect(() => {
    if (unit === "btc") {
      setActiveValue(amountSats > 0 ? formatBtc(amountSats, 6) : "");
      return;
    }
    setActiveValue(formatUsdInputValue(usdAmount));
  }, [unit, amountSats, usdAmount]);

  const handleInputChange = (nextValue: string) => {
    const sanitized = unit === "btc" ? sanitizeBtcInput(nextValue) : sanitizeUsdInput(nextValue);
    if (sanitized === null) return;
    setActiveValue(sanitized);
    const nextSats =
      unit === "btc" ? parseBtcToSats(sanitized) : parseUsdInputToSats(sanitized, btcPrice);
    onAmountSatsChange(nextSats);
  };

  const handleUnitSwap = () => {
    setUnit((u) => (u === "btc" ? "usd" : "btc"));
  };

  const handleSliderChange = (vals: number[]) => {
    const pct = vals[0] ?? 0;
    if (maxAmountSats <= 0) {
      onAmountSatsChange(0);
      return;
    }
    onAmountSatsChange(Math.round((pct / 100) * maxAmountSats));
  };

  const handlePreset = (fraction: number) => {
    if (maxAmountSats <= 0) return;
    onAmountSatsChange(Math.round(fraction * maxAmountSats));
  };

  const sliderValue = maxAmountSats > 0 ? [Math.min((amountSats / maxAmountSats) * 100, 100)] : [0];
  const otherDisplay =
    unit === "btc" ? `$${Math.round(usdAmount).toLocaleString()}` : `₿${formatBtc(amountSats, 6)}`;
  const maxDisplay =
    unit === "btc"
      ? `₿${formatBtc(maxAmountSats, 6)}`
      : `$${Math.round(satsToBtc(maxAmountSats) * btcPrice).toLocaleString()}`;
  const inputWidthCh = Math.max(1, activeValue.length || 1);

  return (
    <div className="space-y-5">
      <label
        htmlFor={inputId}
        className={cn(
          "block rounded-xl border bg-muted/20 px-4 py-4 cursor-text transition-colors",
          hasError
            ? "border-destructive/60 bg-destructive/5"
            : "focus-within:border-primary/60 focus-within:bg-muted/30",
        )}
      >
        <div className="flex items-center justify-center gap-2 mb-2">
          <span className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground font-medium">
            {eyebrow}
          </span>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              handleUnitSwap();
            }}
            aria-label={tForms("swapCurrencyInput")}
            className="flex items-center gap-1 rounded-full border bg-background px-2 py-0.5 text-[11px] font-semibold tracking-wide"
          >
            {unit.toUpperCase()}
            <ChevronsUpDown className="size-3" />
          </button>
        </div>
        <div className="flex items-center justify-center gap-1 text-3xl">
          <span className=" font-bold text-muted-foreground">{unit === "btc" ? "₿" : "$"}</span>
          <input
            id={inputId}
            type="text"
            inputMode="decimal"
            value={activeValue}
            onChange={(e) => handleInputChange(e.target.value)}
            placeholder="0"
            style={{ width: `${inputWidthCh}ch` }}
            className="bg-transparent border-0 p-0 font-bold tabular-nums focus:outline-none text-foreground min-w-[1ch]"
            aria-label={eyebrow}
          />
        </div>
        {isBelowMin && minAmountSats !== undefined ? (
          <p className="text-center text-sm text-destructive mt-2 tabular-nums font-medium">
            {tCommon("min")} · {formatBtcWithSymbol(minAmountSats, 6)}
          </p>
        ) : isAboveMax ? (
          <p className="text-center text-sm text-destructive mt-2 tabular-nums font-medium">
            {tCommon("max")} · {formatBtcWithSymbol(maxAmountSats, 6)}
          </p>
        ) : (
          <p className="text-center text-sm text-muted-foreground mt-2 tabular-nums">
            ≈ {otherDisplay}
          </p>
        )}
      </label>

      <div className="space-y-3">
        <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.12em] font-medium">
          <span className="text-muted-foreground">{tForms("amount")}</span>
          <button
            type="button"
            onClick={() => handlePreset(1)}
            className="text-muted-foreground tabular-nums"
          >
            <span className="text-muted-foreground/70">{tForms("max")} · </span>
            <span className="text-foreground">{maxDisplay}</span>
          </button>
        </div>
        <Slider
          value={sliderValue}
          onValueChange={handleSliderChange}
          min={0}
          max={100}
          step={0.1}
        />
      </div>

      <div className="grid grid-cols-4 gap-2">
        {PRESETS.map((fraction) => {
          const isMax = fraction === 1;
          const currentFraction = maxAmountSats > 0 ? amountSats / maxAmountSats : 0;
          const active = maxAmountSats > 0 && Math.abs(currentFraction - fraction) < 0.001;
          return (
            <Button
              key={fraction}
              variant="outline"
              onClick={() => handlePreset(fraction)}
              className={cn("tabular-nums", active && "ring-1")}
            >
              {isMax ? tForms("max") : `${Math.round(fraction * 100)}%`}
            </Button>
          );
        })}
      </div>
    </div>
  );
}

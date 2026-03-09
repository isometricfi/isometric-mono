"use client";

import { ArrowUpDown } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import {
  formatUsdInputValue,
  parseUsdInputToSats,
  sanitizeBtcInput,
  sanitizeUsdInput,
} from "@/lib/options-form";
import { formatBtc, parseBtcToSats, satsToBtc } from "@/lib/utils";
import { Slider } from "../ui/slider";

interface BtcUsdAmountSectionProps {
  label: string;
  amountSats: number;
  btcPrice: number;
  maxAmountSats: number;
  onAmountSatsChange: (amountSats: number) => void;
}

type InputUnit = "btc" | "usd";

export function BtcUsdAmountSection({
  label,
  amountSats,
  btcPrice,
  maxAmountSats,
  onAmountSatsChange,
}: BtcUsdAmountSectionProps) {
  const t = useTranslations("Forms");
  const [activeInputUnit, setActiveInputUnit] = useState<InputUnit>("btc");
  const [activeInputValue, setActiveInputValue] = useState("");

  const usdAmount = useMemo(() => {
    if (btcPrice <= 0) return 0;
    return satsToBtc(amountSats) * btcPrice;
  }, [amountSats, btcPrice]);

  useEffect(() => {
    if (activeInputUnit === "btc") {
      setActiveInputValue(amountSats > 0 ? formatBtc(amountSats, 6) : "");
      return;
    }

    setActiveInputValue(formatUsdInputValue(usdAmount));
  }, [activeInputUnit, amountSats, usdAmount]);

  const handleAmountInputChange = (nextValue: string) => {
    const sanitizedValue =
      activeInputUnit === "btc" ? sanitizeBtcInput(nextValue) : sanitizeUsdInput(nextValue);
    if (sanitizedValue === null) return;

    setActiveInputValue(sanitizedValue);
    const nextAmountSats =
      activeInputUnit === "btc"
        ? parseBtcToSats(sanitizedValue)
        : parseUsdInputToSats(sanitizedValue, btcPrice);
    onAmountSatsChange(nextAmountSats);
  };

  const handleInputUnitSwap = () => {
    setActiveInputUnit((currentUnit) => (currentUnit === "btc" ? "usd" : "btc"));
  };

  const handleMaxClick = () => {
    onAmountSatsChange(maxAmountSats);
  };

  const handleAmountSliderChange = (sliderValue: number[]) => {
    const nextPercentage = sliderValue[0] ?? 0;
    if (maxAmountSats <= 0) {
      onAmountSatsChange(0);
      return;
    }

    const nextAmountSats = Math.round((nextPercentage / 100) * maxAmountSats);
    onAmountSatsChange(nextAmountSats);
  };

  const sliderValue = maxAmountSats > 0 ? [Math.min((amountSats / maxAmountSats) * 100, 100)] : [0];
  const inputWidthCh = Math.max(1, activeInputValue.length || 1);

  return (
    <div className="rounded-lg bg-muted/20 p-3 space-y-3 border">
      <div className="flex justify-between items-center">
        <div>
          <p className="font-semibold text-foreground text-sm">{label}</p>
          <button
            type="button"
            onClick={handleMaxClick}
            className="text-xs font-medium cursor-pointer"
          >
            <span className="text-muted-foreground">{t("max")}: </span>
            {activeInputUnit === "btc"
              ? `₿${formatBtc(maxAmountSats, 6)}`
              : `$${Math.round(satsToBtc(maxAmountSats) * btcPrice).toLocaleString()}`}
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleInputUnitSwap}
            className="p-1 bg-muted text-sm font-medium cursor-pointer flex gap-1 items-center"
            aria-label={t("swapCurrencyInput")}
          >
            {activeInputUnit === "btc"
              ? `$${Math.round(usdAmount).toLocaleString()}`
              : `₿${formatBtc(amountSats, 6)}`}
            <ArrowUpDown className="size-4" />
          </button>
          <div className="md:text-lg text-base font-bold flex items-center">
            <span>{activeInputUnit === "btc" ? "₿" : "$"}</span>
            <input
              type="text"
              inputMode="decimal"
              value={activeInputValue}
              onChange={(event) => handleAmountInputChange(event.target.value)}
              placeholder="0"
              style={{ width: `${inputWidthCh}ch` }}
              className="bg-transparent border-0 p-0 text-inherit font-inherit text-left tabular-nums focus:outline-none"
              aria-label={label}
            />
          </div>
        </div>
      </div>
      <Slider
        value={sliderValue}
        onValueChange={handleAmountSliderChange}
        min={0}
        max={100}
        step={0.1}
      />
    </div>
  );
}

"use client";

import { ArrowUpDown } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { Slider } from "@/components/ui/slider";
import { btcToSats, formatBtc, parseBtcToSats, satsToBtc } from "@/lib/utils";
import { sanitizeWriterBtcInput, sanitizeWriterUsdInput } from "./_internal/earnings-amount";

interface WriteCollateralSectionProps {
  amountSats: number;
  btcPrice: number;
  maxCollateralSats: number;
  onAmountSatsChange: (amountSats: number) => void;
}

type InputUnit = "btc" | "usd";

export function WriteCollateralSection({
  amountSats,
  btcPrice,
  maxCollateralSats,
  onAmountSatsChange,
}: WriteCollateralSectionProps) {
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
      activeInputUnit === "btc"
        ? sanitizeWriterBtcInput(nextValue)
        : sanitizeWriterUsdInput(nextValue);
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
    onAmountSatsChange(maxCollateralSats);
  };

  const handleAmountSliderChange = (sliderValue: number[]) => {
    const nextPercentage = sliderValue[0] ?? 0;
    if (maxCollateralSats <= 0) {
      onAmountSatsChange(0);
      return;
    }

    const nextAmountSats = Math.round((nextPercentage / 100) * maxCollateralSats);
    onAmountSatsChange(nextAmountSats);
  };

  const sliderValue =
    maxCollateralSats > 0 ? [Math.min((amountSats / maxCollateralSats) * 100, 100)] : [0];
  const inputWidthCh = Math.max(1, activeInputValue.length || 1);

  return (
    <div className="rounded-lg bg-muted/20 p-3 space-y-3 border">
      <div className="flex justify-between items-center">
        <div>
          <p className="font-semibold text-foreground text-sm">{t("collateral")}</p>
          <button
            type="button"
            onClick={handleMaxClick}
            className="text-xs font-medium cursor-pointer"
          >
            <span className="text-muted-foreground">{t("max")}: </span>
            {activeInputUnit === "btc"
              ? `₿${formatBtc(maxCollateralSats, 6)}`
              : `$${Math.round(satsToBtc(maxCollateralSats) * btcPrice).toLocaleString()}`}
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
              aria-label={t("collateral")}
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

function formatUsdInputValue(usdAmount: number): string {
  if (!Number.isFinite(usdAmount) || usdAmount <= 0) return "";
  return Number(usdAmount.toFixed(2)).toString();
}

function parseUsdInputToSats(usdAmountInput: string, btcPrice: number): number {
  const usdAmount = parseFloat(usdAmountInput);
  if (Number.isNaN(usdAmount) || usdAmount <= 0 || btcPrice <= 0) return 0;

  return btcToSats(usdAmount / btcPrice);
}

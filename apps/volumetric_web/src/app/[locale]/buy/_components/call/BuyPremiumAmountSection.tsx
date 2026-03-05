"use client";

import { ArrowUpDown } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { Slider } from "@/components/ui/slider";
import { btcToSats, formatBtc, parseBtcToSats, satsToBtc } from "@/lib/utils";
import { sanitizePremiumAmountInput, sanitizeUsdAmountInput } from "./_internal/premium-amount";

interface BuyPremiumAmountSectionProps {
  amountSats: number;
  maxPremiumAmountSats: number;
  btcPrice: number;
  onAmountSatsChange: (amountSats: number) => void;
}

type InputUnit = "btc" | "usd";

export function BuyPremiumAmountSection({
  amountSats,
  maxPremiumAmountSats,
  btcPrice,
  onAmountSatsChange,
}: BuyPremiumAmountSectionProps) {
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
        ? sanitizePremiumAmountInput(nextValue)
        : sanitizeUsdAmountInput(nextValue);
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

  const handleAmountSliderChange = (sliderValue: number[]) => {
    const nextPercentage = sliderValue[0] ?? 0;
    if (maxPremiumAmountSats <= 0) {
      onAmountSatsChange(0);
      return;
    }

    const nextAmountSats = Math.round((nextPercentage / 100) * maxPremiumAmountSats);
    onAmountSatsChange(nextAmountSats);
  };

  const handleMaxClick = () => {
    onAmountSatsChange(maxPremiumAmountSats);
  };

  const sliderValue =
    maxPremiumAmountSats > 0 ? [Math.min((amountSats / maxPremiumAmountSats) * 100, 100)] : [0];
  const inputWidthCh = Math.max(1, activeInputValue.length || 1);

  return (
    <div className="rounded-lg bg-muted/20 p-3 space-y-3 border">
      <div className="flex justify-between items-center">
        <div className="">
          <p className="font-semibold text-foreground text-sm">{t("amount")}</p>
          <button
            type="button"
            onClick={handleMaxClick}
            className="text-xs font-medium cursor-pointer"
          >
            <span className="text-muted-foreground">{t("max")}: </span>₿
            {formatBtc(maxPremiumAmountSats, 6)}
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
          <div className="text-lg font-bold flex items-center">
            <span>{activeInputUnit === "btc" ? "₿" : "$"}</span>
            <input
              type="text"
              inputMode="decimal"
              value={activeInputValue}
              onChange={(event) => handleAmountInputChange(event.target.value)}
              placeholder="0"
              style={{ width: `${inputWidthCh}ch` }}
              className="bg-transparent border-0 p-0 text-inherit font-inherit text-left tabular-nums focus:outline-none"
              aria-label={t("amount")}
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

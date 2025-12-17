"use client";

import { Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { AmountInput } from "@/components/options/AmountInput";
import { TermSelector } from "@/components/options/TermSelector";
import { Button } from "@/components/ui/button";
import { NumberCarousel } from "@/components/ui/number-carousel";
import { generatePremiumValues, useConfig } from "@/hooks/useConfig";
import { usePrices } from "@/hooks/usePrices";
import { formatBtc, parseBtcToSats } from "@/lib/utils";
import { CallWriteOptionSummary } from "./CallWriteOptionSummary";

export function CallWriteOptionForm() {
  const { data: priceData } = usePrices();
  const { data: config } = useConfig();
  const btcPrice = priceData?.btc ?? 0;

  const strikePercentOptions = config?.strikePercentOptions ?? [];
  const premiumValues = useMemo(() => generatePremiumValues(config), [config]);
  const minOfferAmountSats = config?.minOfferAmountSats ?? 100_000;
  const maxOfferAmountSats = config?.maxOfferAmountSats ?? 100_000_000;
  const defaultTerm = config?.termOptions[0] ?? 7;

  const [term, setTerm] = useState(defaultTerm);
  const [strikePercent, setStrikePercent] = useState(strikePercentOptions[0] ?? 5);
  const [premium, setPremium] = useState(premiumValues[3] ?? 1);
  const [amountBtc, setAmountBtc] = useState("");

  const handleSubmit = () => {};

  const amountSats = parseBtcToSats(amountBtc);

  const strikeUsd = useMemo(
    () => Math.round(btcPrice * (1 + strikePercent / 100)),
    [btcPrice, strikePercent],
  );

  return (
    <div className="bg-card rounded-3xl border border-border p-6 space-y-5 h-fit">
      <TermSelector value={term} onChange={setTerm} />

      {strikePercentOptions.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-foreground">Strike</p>
            {btcPrice > 0 && (
              <span className="text-sm text-muted-foreground">~${strikeUsd.toLocaleString()}</span>
            )}
          </div>
          <NumberCarousel
            values={strikePercentOptions}
            value={strikePercent}
            onChange={setStrikePercent}
            formatValue={(v) => `+${v}%`}
          />
        </div>
      )}

      {premiumValues.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between relative">
            <p className="text-sm font-medium text-foreground">Premium</p>
            <div className="opacity-80 text-xs flex items-center gap-1">
              <Sparkles className="size-3.5" />
              <span>Lower is more competitive</span>
            </div>
          </div>
          <NumberCarousel
            values={premiumValues}
            value={premium}
            onChange={setPremium}
            formatValue={(v) => `${v}%`}
          />
        </div>
      )}

      <AmountInput value={amountBtc} onChange={setAmountBtc} minAmountSats={minOfferAmountSats} />

      <Button
        onClick={handleSubmit}
        className="w-full rounded-full py-6 text-base font-semibold"
        size="lg"
        disabled={amountSats < minOfferAmountSats || amountSats > maxOfferAmountSats}
      >
        {amountSats < minOfferAmountSats
          ? `Min: ${formatBtc(minOfferAmountSats)} BTC`
          : amountSats > maxOfferAmountSats
            ? `Max: ${formatBtc(maxOfferAmountSats)} BTC`
            : "Create Offer"}
      </Button>

      <CallWriteOptionSummary
        amountSats={amountSats}
        premium={premium}
        term={term}
        strikePercent={strikePercent}
      />
    </div>
  );
}

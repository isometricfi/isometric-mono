"use client";

import { useDynamicContext } from "@dynamic-labs/sdk-react-core";
import { Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { AmountInput } from "@/components/options/AmountInput";
import { TermSelector } from "@/components/options/TermSelector";
import { Button } from "@/components/ui/button";
import { NumberCarousel } from "@/components/ui/number-carousel";
import { useCreateOffer } from "@/hooks/use-create-offer";
import { generatePremiumValues, useConfig } from "@/hooks/useConfig";
import { usePrices } from "@/hooks/usePrices";
import { formatBtc, parseBtcToSats } from "@/lib/utils";
import { CallWriteOptionSummary } from "./CallWriteOptionSummary";

export function CallWriteOptionForm() {
  const { primaryWallet } = useDynamicContext();
  const { data: priceData } = usePrices();
  const { data: config } = useConfig();
  const createOffer = useCreateOffer();
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

  const handleSubmit = () => {
    createOffer.mutate({
      quantitySats: amountSats,
      strikePercent,
      premiumPercent: premium,
      termDays: term,
    });
  };

  const amountSats = parseBtcToSats(amountBtc);

  const strikeUsd = useMemo(
    () => Math.round(btcPrice * (1 + strikePercent / 100)),
    [btcPrice, strikePercent],
  );

  const isValidAmount = amountSats >= minOfferAmountSats && amountSats <= maxOfferAmountSats;
  const isWalletConnected = !!primaryWallet;

  const getButtonText = () => {
    if (!isWalletConnected) return "Connect Wallet";
    if (createOffer.isPending) return "Creating Offer...";
    if (amountSats < minOfferAmountSats) return `Min: ${formatBtc(minOfferAmountSats)} BTC`;
    if (amountSats > maxOfferAmountSats) return `Max: ${formatBtc(maxOfferAmountSats)} BTC`;
    return "Create Offer";
  };

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
        disabled={!isWalletConnected || !isValidAmount || createOffer.isPending}
      >
        {getButtonText()}
      </Button>

      {createOffer.isSuccess && (
        <div className="p-3 bg-green-950 border border-green-800 rounded-lg">
          <div className="text-sm text-green-400">
            Offer created! ID: {createOffer.data.offerId}
          </div>
        </div>
      )}

      {createOffer.isError && (
        <div className="p-3 bg-red-950 border border-red-800 rounded-lg">
          <div className="text-sm text-red-400">{createOffer.error?.message}</div>
        </div>
      )}

      <CallWriteOptionSummary
        amountSats={amountSats}
        premium={premium}
        term={term}
        strikePercent={strikePercent}
      />
    </div>
  );
}

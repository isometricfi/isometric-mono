"use client";

import { Button } from "@/components/ui/button";
import { SlidingNumber } from "@/components/ui/sliding-number";
import { usePrices } from "@/hooks/usePrices";
import { satsToBtc } from "@/lib/sats";
import type { OptionOffer } from "@/store/optionsStore";
import { CallBuyHowItWorksModal } from "./CallBuyHowItWorksModal";

interface CallBuyOptionSummaryProps {
  amountSats: number;
  bestOffer: OptionOffer | null;
  term: number;
  strikePercent: number;
}

export function CallBuyOptionSummary({
  amountSats,
  bestOffer,
  term,
  strikePercent,
}: CallBuyOptionSummaryProps) {
  const { data: priceData } = usePrices();
  const btcPrice = priceData?.btc ?? 0;

  const premium = bestOffer?.premium ?? 0;
  const premiumSats = Math.round(amountSats * (premium / 100));
  const premiumBtc = satsToBtc(premiumSats);

  // max profit is amount minus premium paid (when BTC -> infinity)
  const maxProfitSats = amountSats - premiumSats;
  const maxProfitBtc = satsToBtc(maxProfitSats);

  // compute strike USD
  const strikeUsd = Math.round(btcPrice * (1 + strikePercent / 100));

  // format to fixed decimal places for sliding number
  const premiumDisplay = Number(premiumBtc.toFixed(6));
  const maxProfitDisplay = Number(maxProfitBtc.toFixed(6));

  if (!bestOffer && amountSats > 0) {
    return (
      <div className="space-y-3 pt-4 border-t border-border">
        <p className="text-sm text-muted-foreground text-center">
          No offers available for this amount
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3 pt-4 border-t border-border">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <p className="text-muted-foreground">Premium:</p>
          <div className="font-semibold flex items-center">
            <span>₿&nbsp;</span>
            <SlidingNumber value={premiumDisplay} />
          </div>
          <div className="text-sm text-primary font-medium">({premium}%)</div>
        </div>
        <div className="flex items-end gap-2">
          <p className="text-muted-foreground">Max profit:</p>
          <div className="font-semibold text-green-500 flex items-center">
            <span>₿&nbsp;</span>
            <SlidingNumber value={maxProfitDisplay} />
          </div>
        </div>
      </div>

      <div className="flex flex-col md:flex-row md:items-end justify-between gap-3">
        <p className="text-[13px] text-muted-foreground/70">
          Pay ₿{premiumDisplay} upfront. Strike locks at ~$
          {strikeUsd.toLocaleString()}. Profit auto-exercised if BTC exceeds strike in {term} days.
          Max loss is the premium.
        </p>
        <CallBuyHowItWorksModal
          trigger={
            <Button variant="outline" size="sm" className="shrink-0 text-xs">
              Learn
            </Button>
          }
        />
      </div>
    </div>
  );
}

"use client";

import type { Offer } from "@volumetric/canister-types";
import { Button } from "@/components/ui/button";
import { SlidingNumber } from "@/components/ui/sliding-number";
import { usePrices } from "@/hooks";
import { basisPointsToPercent, multiplySats, satsToBtc } from "@/lib/utils";
import { CallBuyHowItWorksModal } from "./CallBuyHowItWorksModal";

interface CallBuyOptionSummaryProps {
  amountSats: bigint;
  bestOffer: Offer | null;
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

  const premium = bestOffer ? basisPointsToPercent(bestOffer.premium_basis_points) : 0;
  const premiumSats = multiplySats(amountSats, premium / 100);
  const premiumBtc = satsToBtc(premiumSats);

  const maxProfitSats = amountSats - premiumSats;
  const maxProfitBtc = satsToBtc(maxProfitSats);

  const strikeUsd = Math.round(btcPrice * (1 + strikePercent / 100));

  const premiumDisplay = premiumBtc.round(6).toNumber();
  const maxProfitDisplay = maxProfitBtc.round(6).toNumber();

  if (!bestOffer && amountSats > BigInt(0)) {
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

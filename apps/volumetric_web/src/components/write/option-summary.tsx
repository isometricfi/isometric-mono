"use client";

import { Button } from "@/components/ui/button";
import { SlidingNumber } from "@/components/ui/sliding-number";
import { type TermDays } from "./term-selector";
import { HowItWorksModal } from "./how-it-works-modal";

interface OptionSummaryProps {
  amount: number;
  premium: number;
  term: TermDays;
}

export function OptionSummary({ amount, premium, term }: OptionSummaryProps) {
  const premiumBtc = amount * (premium / 100);
  const apy = Math.round((premium / 100) * (365 / term) * 100);

  // format to fixed decimal places for sliding number
  const premiumDisplay = Number(premiumBtc.toFixed(6));

  return (
    <div className="space-y-3 pt-4 border-t border-border">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-2xl font-semibold flex items-center">
            <span>₿&nbsp;</span>
            <SlidingNumber value={premiumDisplay} />
          </div>
          <p className="text-sm text-muted-foreground">Premium</p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-semibold text-primary flex items-center justify-end">
            <SlidingNumber value={apy} />
            <span>%</span>
          </div>
          <p className="text-sm text-muted-foreground">APY</p>
        </div>
      </div>
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs text-muted-foreground/70">
          Locked for {term} days when accepted. You get the premium instantly.
          If BTC goes above strike, buyer&apos;s profit is taken from your
          collateral.
        </p>
        <HowItWorksModal
          trigger={
            <Button variant="outline" size="sm" className="shrink-0 text-xs">
              Learn more
            </Button>
          }
        />
      </div>
    </div>
  );
}

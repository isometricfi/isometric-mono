"use client";

import { useMemo, useState } from "react";
import { AmountInput } from "@/components/options/AmountInput";
import { TermSelector } from "@/components/options/TermSelector";
import { Button } from "@/components/ui/button";
import { NumberCarousel } from "@/components/ui/number-carousel";
import { useConfig } from "@/hooks/useConfig";
import {
  findBestOffer,
  getMaxLiquiditySats,
  getStrikePercentsForTerm,
  useOptions,
} from "@/hooks/useOptions";
import { usePrices } from "@/hooks/usePrices";
import { formatBtc, parseBtcToSats } from "@/lib/sats";
import { CallBuyOptionSummary } from "./CallBuyOptionSummary";

// compute USD strike values from percentages and BTC price
function computeStrikeUsdValues(strikePercents: number[], btcPrice: number): number[] {
  return strikePercents.map((pct) => Math.round(btcPrice * (1 + pct / 100)));
}

export function CallOptionBuyForm() {
  const { data } = useOptions();
  const { data: priceData } = usePrices();
  const { data: config } = useConfig();
  const btcPrice = priceData?.btc ?? 0;

  const minOfferAmountSats = config?.minOfferAmountSats ?? 100_000;
  const defaultTerm = config?.termOptions[0] ?? 7;

  const [term, setTerm] = useState(defaultTerm);
  const [amountBtc, setAmountBtc] = useState("");

  // get available strike percentages for the selected term
  const strikePercents = useMemo(() => getStrikePercentsForTerm(data, term), [data, term]);

  // compute USD values for carousel display
  const strikeUsdValues = useMemo(
    () => computeStrikeUsdValues(strikePercents, btcPrice),
    [strikePercents, btcPrice],
  );

  const [strikePercent, setStrikePercent] = useState<number>(strikePercents[0] ?? 5);

  // update strike when term changes if current strike isn't available
  useMemo(() => {
    if (strikePercents.length > 0 && !strikePercents.includes(strikePercent)) {
      setStrikePercent(strikePercents[0]);
    }
  }, [strikePercents, strikePercent]);

  // convert BTC input to sats for calculations
  const amountSats = parseBtcToSats(amountBtc);

  // get max liquidity for selected term and strikePercent (in sats)
  const maxLiquiditySats = getMaxLiquiditySats(data, term, strikePercent);

  // find best offer for the entered amount
  const bestOffer = findBestOffer(data, term, strikePercent, amountSats);

  // current selected USD value
  const selectedStrikeUsd = useMemo(
    () => Math.round(btcPrice * (1 + strikePercent / 100)),
    [btcPrice, strikePercent],
  );

  // handle USD value change - map back to percentage
  const handleStrikeUsdChange = (usdValue: number) => {
    const index = strikeUsdValues.indexOf(usdValue);
    if (index !== -1) {
      setStrikePercent(strikePercents[index]);
    }
  };

  const handleSubmit = () => {
    // TODO: implement buy logic
  };

  const handleMaxClick = () => {
    setAmountBtc(formatBtc(maxLiquiditySats, 8));
  };

  const isValidAmount = amountSats > 0 && amountSats <= maxLiquiditySats;

  return (
    <div className="bg-card rounded-3xl border border-border p-6 space-y-5 h-fit">
      <TermSelector value={term} onChange={setTerm} />

      {strikePercents.length > 0 && btcPrice > 0 ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-foreground">Strike</p>
            <span className="text-sm text-muted-foreground">+{strikePercent}% above current</span>
          </div>
          <NumberCarousel
            values={strikeUsdValues}
            value={selectedStrikeUsd}
            onChange={handleStrikeUsdChange}
            formatValue={(v) => `$${v.toLocaleString()}`}
          />
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-sm font-medium text-foreground">Strike</p>
          <div className="flex items-center justify-center py-3 px-4 bg-secondary/50 rounded-full">
            <span className="text-sm text-muted-foreground">
              {btcPrice === 0 ? "Loading price..." : "No strikes available"}
            </span>
          </div>
        </div>
      )}

      <AmountInput
        value={amountBtc}
        onChange={setAmountBtc}
        maxAmountSats={maxLiquiditySats}
        minAmountSats={minOfferAmountSats}
        onMaxClick={handleMaxClick}
      />

      <Button
        onClick={handleSubmit}
        className="w-full rounded-full py-6 text-base font-semibold"
        size="lg"
        disabled={!isValidAmount || !bestOffer}
      >
        {!isValidAmount && amountSats > maxLiquiditySats ? "Insufficient liquidity" : "Buy Option"}
      </Button>

      <CallBuyOptionSummary
        amountSats={amountSats}
        bestOffer={bestOffer}
        term={term}
        strikePercent={strikePercent}
      />
    </div>
  );
}

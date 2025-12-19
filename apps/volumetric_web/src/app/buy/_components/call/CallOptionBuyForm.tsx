"use client";

import { useDynamicContext } from "@dynamic-labs/sdk-react-core";
import { useMemo, useState } from "react";
import { AmountInput } from "@/components/options/AmountInput";
import { OfferResultModal } from "@/components/options/OfferResultModal";
import { TermSelector } from "@/components/options/TermSelector";
import { Button } from "@/components/ui/button";
import { NumberCarousel } from "@/components/ui/number-carousel";
import {
  findBestOffer,
  getMaxLiquiditySats,
  getStrikePercentsForTerm,
  useAcceptOffer,
  useConfig,
  useOptions,
  usePrices,
} from "@/hooks";
import { formatBtc, parseBtcToSats } from "@/lib/utils";
import { CallBuyOptionSummary } from "./CallBuyOptionSummary";

function computeStrikeUsdValues(strikePercents: number[], btcPrice: number): number[] {
  return strikePercents.map((pct) => Math.round(btcPrice * (1 + pct / 100)));
}

export function CallOptionBuyForm() {
  const { primaryWallet } = useDynamicContext();
  const { data } = useOptions();
  const { data: priceData } = usePrices();
  const { data: config } = useConfig();
  const acceptOffer = useAcceptOffer();
  const btcPrice = priceData?.btc ?? 0;

  const minOfferAmountSats = config?.minOfferAmountSats ?? 100_000;
  const defaultTerm = config?.termOptions[0] ?? 7;

  const [term, setTerm] = useState(defaultTerm);
  const [amountBtc, setAmountBtc] = useState("");

  const showModal = acceptOffer.step !== "idle";

  const strikePercents = useMemo(() => getStrikePercentsForTerm(data, term), [data, term]);

  const strikeUsdValues = useMemo(
    () => computeStrikeUsdValues(strikePercents, btcPrice),
    [strikePercents, btcPrice],
  );

  const [strikePercent, setStrikePercent] = useState<number>(strikePercents[0] ?? 5);

  useMemo(() => {
    if (strikePercents.length > 0 && !strikePercents.includes(strikePercent)) {
      setStrikePercent(strikePercents[0]);
    }
  }, [strikePercents, strikePercent]);

  const amountSats = parseBtcToSats(amountBtc);
  const maxLiquiditySats = getMaxLiquiditySats(data, term, strikePercent);
  const bestOffer = findBestOffer(data, term, strikePercent, amountSats);

  const selectedStrikeUsd = useMemo(
    () => Math.round(btcPrice * (1 + strikePercent / 100)),
    [btcPrice, strikePercent],
  );

  const handleStrikeUsdChange = (usdValue: number) => {
    const index = strikeUsdValues.indexOf(usdValue);
    if (index !== -1) {
      setStrikePercent(strikePercents[index]);
    }
  };

  const handleSubmit = () => {
    if (!bestOffer) return;
    acceptOffer.mutate({
      offerId: bestOffer.id,
      quantitySats: amountSats,
    });
  };

  const handleMaxClick = () => {
    setAmountBtc(formatBtc(maxLiquiditySats, 8));
  };

  const handleModalClose = (open: boolean) => {
    if (!open) {
      if (acceptOffer.step === "success") {
        setAmountBtc("");
      }
      acceptOffer.reset();
    }
  };

  const isWalletConnected = !!primaryWallet;
  const isValidAmount = amountSats > 0 && amountSats <= maxLiquiditySats;
  const hasInsufficientLiquidity = amountSats > maxLiquiditySats;

  const getButtonText = () => {
    if (!isWalletConnected) return "Connect Wallet";
    if (acceptOffer.isPending) return "Buying Option...";
    if (hasInsufficientLiquidity) return "Insufficient liquidity";
    if (!bestOffer && amountSats > 0) return "No offers available";
    return "Buy Option";
  };

  return (
    <div className="bg-card rounded-3xl border border-border p-6 space-y-5 h-fit">
      <TermSelector value={term} onChange={setTerm} />

      {strikePercents.length > 0 && btcPrice > 0 ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-foreground">Strike</p>
            <span className="text-sm text-muted-foreground">{strikePercent}% above current</span>
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
        disabled={!isWalletConnected || !isValidAmount || !bestOffer || acceptOffer.isPending}
      >
        {getButtonText()}
      </Button>

      <OfferResultModal
        open={showModal}
        onOpenChange={handleModalClose}
        type="buy"
        step={acceptOffer.step}
        fillGroupId={acceptOffer.data?.fillGroupId}
        errorMessage={acceptOffer.error?.message}
      />

      <CallBuyOptionSummary
        amountSats={amountSats}
        bestOffer={bestOffer}
        term={term}
        strikePercent={strikePercent}
      />
    </div>
  );
}

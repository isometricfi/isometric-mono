"use client";

import { useDynamicContext } from "@dynamic-labs/sdk-react-core";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { AmountInput } from "@/components/options/AmountInput";
import { OfferResultModal } from "@/components/options/OfferResultModal";
import { TermSelector } from "@/components/options/TermSelector";
import { Button } from "@/components/ui/button";
import { NumberCarousel } from "@/components/ui/number-carousel";
import { Skeleton } from "@/components/ui/skeleton";
import {
  findBestOffer,
  getMaxLiquiditySats,
  getStrikePercentsForTerm,
  useAcceptOffer,
  useAccount,
  useConfig,
  useOptions,
  usePrices,
} from "@/hooks";
import { DEFAULT_MIN_OFFER_AMOUNT_SATS, formatBtc, parseBtcToSats } from "@/lib/utils";
import { useChartOptionsStore } from "@/stores/chart-options-store";
import { CallBuyOptionSummary } from "./CallBuyOptionSummary";

function computeStrikeUsdValues(strikePercents: number[], btcPrice: number): number[] {
  return strikePercents.map((pct) => Math.round(btcPrice * (1 + pct / 100)));
}

export function CallOptionBuyForm() {
  const { primaryWallet } = useDynamicContext();
  const { data, isLoading } = useOptions();
  const { data: account } = useAccount();
  const { data: priceData } = usePrices();
  const { data: config } = useConfig();
  const acceptOffer = useAcceptOffer();
  const btcPrice = priceData?.btc ?? 0;
  const t = useTranslations("Forms");
  const tCommon = useTranslations("Common");

  const setChartStrikePercent = useChartOptionsStore((state) => state.setStrikePercent);
  const setChartTermDays = useChartOptionsStore((state) => state.setTermDays);

  const minOfferAmountSats = config?.minOfferAmountSats ?? DEFAULT_MIN_OFFER_AMOUNT_SATS;
  const defaultTerm = config?.termOptions[0] ?? 7;

  const [term, setTermLocal] = useState(defaultTerm);
  const [amountBtc, setAmountBtc] = useState("");

  const setTerm = (value: number) => {
    setTermLocal(value);
    setChartTermDays(value);
  };

  const showModal = acceptOffer.step !== "idle";

  // Filter out options created by the current user
  const filteredData = useMemo(() => {
    if (!data) return undefined;
    if (!account?.profile?.principal) return data;

    const userPrincipal = account.profile.principal;

    return {
      ...data,
      termGroups: data.termGroups
        .map((group) => ({
          ...group,
          strikes: group.strikes
            .map((strike) => ({
              ...strike,
              offers: strike.offers.filter((offer) => offer.writerId !== userPrincipal),
            }))
            .filter((strike) => strike.offers.length > 0),
        }))
        .filter((group) => group.strikes.length > 0),
    };
  }, [data, account]);

  const strikePercents = useMemo(
    () => getStrikePercentsForTerm(filteredData, term),
    [filteredData, term],
  );

  const strikeUsdValues = useMemo(
    () => computeStrikeUsdValues(strikePercents, btcPrice),
    [strikePercents, btcPrice],
  );

  const [strikePercent, setStrikePercentLocal] = useState<number>(strikePercents[0] ?? 5);

  const setStrikePercent = (value: number) => {
    setStrikePercentLocal(value);
    setChartStrikePercent(value);
  };

  const amountSats = parseBtcToSats(amountBtc);
  const maxLiquiditySats = getMaxLiquiditySats(filteredData, term, strikePercent);
  const displayMaxSats = maxLiquiditySats >= minOfferAmountSats ? maxLiquiditySats : 0;
  const bestOffer = findBestOffer(filteredData, term, strikePercent, amountSats);

  const selectedStrikeUsd = useMemo(
    () => Math.round(btcPrice * (1 + strikePercent / 100)),
    [btcPrice, strikePercent],
  );

  useEffect(() => {
    if (maxLiquiditySats < minOfferAmountSats) {
      setAmountBtc("");
      return;
    }

    if (maxLiquiditySats > 0) {
      const halfMaxSats = Math.floor(maxLiquiditySats / 2);
      const defaultAmountSats =
        halfMaxSats >= minOfferAmountSats ? halfMaxSats : minOfferAmountSats;
      setAmountBtc(formatBtc(defaultAmountSats, 5));
    }
  }, [maxLiquiditySats, minOfferAmountSats]);

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
  const isValidAmount = amountSats >= minOfferAmountSats && amountSats <= displayMaxSats;
  const hasInsufficientLiquidity = amountSats > displayMaxSats && displayMaxSats > 0;
  const isBelowMinimum = amountSats > 0 && amountSats < minOfferAmountSats;

  const getButtonText = () => {
    if (!isWalletConnected) return t("connectWallet");
    if (acceptOffer.isPending) return t("buyingOption");
    if (hasInsufficientLiquidity) return t("insufficientLiquidity");
    if (isBelowMinimum) return `${tCommon("min")}: ₿${formatBtc(minOfferAmountSats)}`;
    if (!bestOffer && amountSats > 0) return t("noOffersAvailable");
    return t("buyOption");
  };

  return (
    <div className="bg-card rounded-3xl border border-border p-6 space-y-5 h-fit">
      <TermSelector value={term} onChange={setTerm} />

      {isLoading ? (
        <div className="space-y-2">
          <p className="text-sm font-medium text-foreground">{t("strike")}</p>
          <Skeleton className="h-[40px] w-full" />
        </div>
      ) : strikePercents.length > 0 && btcPrice > 0 ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-foreground">{t("strike")}</p>
            <span className="text-sm text-muted-foreground">
              {t("strikePercentAbove", { percent: strikePercent })}
            </span>
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
          <p className="text-sm font-medium text-foreground">{t("strike")}</p>
          <div className="flex items-center justify-center py-3 px-4 bg-secondary/50 rounded-full h-10">
            <span className="text-sm text-muted-foreground">{t("noStrikesAvailable")}</span>
          </div>
        </div>
      )}

      <AmountInput
        value={amountBtc}
        onChange={setAmountBtc}
        maxAmountSats={displayMaxSats}
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

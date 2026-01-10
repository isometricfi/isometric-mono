"use client";

import { useDynamicContext } from "@dynamic-labs/sdk-react-core";
import { Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { AmountInput } from "@/components/options/AmountInput";
import { OfferResultModal } from "@/components/options/OfferResultModal";
import { TermSelector } from "@/components/options/TermSelector";
import { Button } from "@/components/ui/button";
import { NumberCarousel } from "@/components/ui/number-carousel";
import { Skeleton } from "@/components/ui/skeleton";
import { generatePremiumValues, useAccount, useConfig, useCreateOffer, usePrices } from "@/hooks";
import {
  DEFAULT_MAX_OFFER_AMOUNT_SATS,
  DEFAULT_MIN_OFFER_AMOUNT_SATS,
  formatBtc,
  parseBtcToSats,
} from "@/lib/utils";
import { useChartOptionsStore } from "@/stores/chart-options-store";
import { CallWriteOptionSummary } from "./CallWriteOptionSummary";

export function CallWriteOptionForm() {
  const { primaryWallet } = useDynamicContext();
  const { data: priceData } = usePrices();
  const { data: config } = useConfig();
  const { data: accountData } = useAccount();
  const createOffer = useCreateOffer();
  const btcPrice = priceData?.btc ?? 0;
  const t = useTranslations("Forms");
  const tCommon = useTranslations("Common");

  const setChartStrikePercent = useChartOptionsStore((state) => state.setStrikePercent);
  const setChartTermDays = useChartOptionsStore((state) => state.setTermDays);

  const strikePercentOptions = config?.strikePercentOptions ?? [];
  const premiumValues = useMemo(() => generatePremiumValues(config), [config]);
  const minOfferAmountSats = config?.minOfferAmountSats ?? DEFAULT_MIN_OFFER_AMOUNT_SATS;
  const configMaxOfferAmountSats = config?.maxOfferAmountSats ?? DEFAULT_MAX_OFFER_AMOUNT_SATS;
  const availableBalanceSats = Number(accountData?.balance?.available ?? 0);
  const maxOfferAmountSats = Math.min(configMaxOfferAmountSats, availableBalanceSats);
  const defaultTerm = config?.termOptions[0] ?? 7;

  const [termLocal, setTermLocal] = useState(defaultTerm);
  const [strikePercentLocal, setStrikePercentLocal] = useState(strikePercentOptions[0] ?? 5);
  const [premium, setPremium] = useState(premiumValues[3] ?? 1);
  const [amountBtc, setAmountBtc] = useState("");

  const term = termLocal;
  const strikePercent = strikePercentLocal;

  const setTerm = (value: number) => {
    setTermLocal(value);
    setChartTermDays(value);
  };

  const setStrikePercent = (value: number) => {
    setStrikePercentLocal(value);
    setChartStrikePercent(value);
  };

  const showModal = createOffer.step !== "idle";

  const handleSubmit = () => {
    createOffer.mutate({
      quantitySats: amountSats,
      strikePercent,
      premiumPercent: premium,
      termDays: term,
    });
  };

  const handleModalClose = (open: boolean) => {
    if (!open) {
      if (createOffer.step === "success") {
        setAmountBtc("");
      }
      createOffer.reset();
    }
  };

  const handleMaxClick = () => {
    setAmountBtc(formatBtc(maxOfferAmountSats, 8));
  };

  const amountSats = parseBtcToSats(amountBtc);

  const strikeUsd = useMemo(
    () => Math.round(btcPrice * (1 + strikePercent / 100)),
    [btcPrice, strikePercent],
  );

  const isValidAmount = amountSats >= minOfferAmountSats && amountSats <= maxOfferAmountSats;
  const isWalletConnected = !!primaryWallet;

  const getButtonText = () => {
    if (!isWalletConnected) return t("connectWallet");
    if (createOffer.isPending) return t("creatingOffer");
    if (amountSats < minOfferAmountSats)
      return `${tCommon("min")}: ₿${formatBtc(minOfferAmountSats)}`;
    if (amountSats > maxOfferAmountSats)
      return `${tCommon("max")}: ₿${formatBtc(maxOfferAmountSats)}`;
    return t("createOffer");
  };

  return (
    <div className="bg-card rounded-3xl border border-border p-6 space-y-5 h-fit">
      <TermSelector value={term} onChange={setTerm} />

      {strikePercentOptions.length > 0 ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-foreground">{t("strike")}</p>
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
      ) : (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-foreground">{t("strike")}</p>
          </div>
          <Skeleton className="h-[40px] w-full" />
        </div>
      )}

      {premiumValues.length > 0 ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between relative">
            <p className="text-sm font-medium text-foreground">{t("premium")}</p>
            <div className="opacity-80 text-xs flex items-center gap-1">
              <Sparkles className="size-3.5" />
              <span>{t("lowerIsMoreCompetitive")}</span>
            </div>
          </div>
          <NumberCarousel
            values={premiumValues}
            value={premium}
            onChange={setPremium}
            formatValue={(v) => `${v}%`}
          />
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-foreground">{t("premium")}</p>
          </div>
          <Skeleton className="h-[40px] w-full" />
        </div>
      )}

      <AmountInput
        value={amountBtc}
        onChange={setAmountBtc}
        minAmountSats={minOfferAmountSats}
        maxAmountSats={maxOfferAmountSats}
        onMaxClick={handleMaxClick}
      />

      <Button
        onClick={handleSubmit}
        className="w-full rounded-full py-6 text-base font-semibold"
        size="lg"
        disabled={!isWalletConnected || !isValidAmount || createOffer.isPending}
      >
        {getButtonText()}
      </Button>

      <OfferResultModal
        open={showModal}
        onOpenChange={handleModalClose}
        type="create"
        step={createOffer.step}
        offerId={createOffer.data?.offerId}
        errorMessage={createOffer.error?.message}
      />

      <CallWriteOptionSummary
        amountSats={amountSats}
        premium={premium}
        term={term}
        strikePercent={strikePercent}
      />
    </div>
  );
}

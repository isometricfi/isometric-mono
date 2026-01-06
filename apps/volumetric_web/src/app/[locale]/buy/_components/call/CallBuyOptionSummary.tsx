"use client";

import { List } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { SlidingNumber } from "@/components/ui/sliding-number";
import { useConfig, useModal, usePrices } from "@/hooks";
import { basisPointsToPercent, satsToBtc } from "@/lib/utils";
import type { OptionOffer } from "@/types/options";

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
  const { data: config } = useConfig();
  const btcPrice = priceData?.btc ?? 0;
  const t = useTranslations("Summary");
  const { openModal } = useModal();

  const premium = bestOffer?.premium ?? 0;
  const premiumSats = Math.round(amountSats * (premium / 100));
  const premiumBtc = satsToBtc(premiumSats);
  const maxProfitSats = amountSats - premiumSats;
  const maxProfitBtc = satsToBtc(maxProfitSats);
  const strikeUsd = Math.round(btcPrice * (1 + strikePercent / 100));
  const premiumDisplay = Number(premiumBtc.toFixed(6));
  const maxProfitDisplay = Number(maxProfitBtc.toFixed(6));

  const platformFeePercent = basisPointsToPercent(
    Number(config?.fees.profitFeeBasisPoints ?? BigInt(0)),
  );

  const handleOpenBreakdown = () => {
    openModal(
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">{t("optionBreakdown")}</h3>
        <div className="space-y-2">
          <div className="text-sm space-y-2">
            <p className="text-muted-foreground leading-relaxed">
              {t("buyExplainer.intro", {
                premium: `₿${premiumDisplay}`,
                strike: `$${strikeUsd.toLocaleString()}`,
                term: `${term} ${term === 1 ? "day" : "days"}`,
              })}
            </p>

            <div className="pt-2 space-y-1.5">
              <div className="flex items-start gap-2">
                <span className="text-muted-foreground">•</span>
                <p className="text-muted-foreground flex-1">
                  <span className="font-medium text-foreground">{t("buyExplainer.ifRises")}</span>{" "}
                  {t("buyExplainer.ifRisesDesc", { maxProfit: `₿${maxProfitDisplay}` })}
                </p>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-muted-foreground">•</span>
                <p className="text-muted-foreground flex-1">
                  <span className="font-medium text-foreground">{t("buyExplainer.ifBelow")}</span>{" "}
                  {t("buyExplainer.ifBelowDesc")}
                </p>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-muted-foreground">•</span>
                <p className="text-muted-foreground flex-1">
                  <span className="font-medium text-foreground">
                    {t("buyExplainer.platformFee")}
                  </span>{" "}
                  {t("buyExplainer.platformFeeDesc", { fee: platformFeePercent })}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>,
    );
  };

  return (
    <div className="space-y-3 pt-4 border-t border-border">
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2">
          <p className="text-muted-foreground">{t("premium")}</p>
          <div className="font-semibold flex items-center">
            <span>₿&nbsp;</span>
            <SlidingNumber value={premiumDisplay} />
          </div>
          <div className="text-sm text-primary font-medium">({premium}%)</div>
        </div>
        <div className="flex items-end gap-2">
          <p className="text-muted-foreground">{t("maxProfit")}</p>
          <div className="font-semibold text-green-500 flex items-center">
            <span>₿&nbsp;</span>
            <SlidingNumber value={maxProfitDisplay} />
          </div>
        </div>
      </div>

      <Button
        variant="outline"
        size="sm"
        onClick={handleOpenBreakdown}
        className="w-full text-sm text-muted-foreground justify-between  px-3!"
      >
        {t("optionBreakdown")}
        <List className="size-4" />
      </Button>
    </div>
  );
}

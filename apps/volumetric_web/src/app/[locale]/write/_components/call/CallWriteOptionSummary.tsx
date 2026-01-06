"use client";

import { List } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { SlidingNumber } from "@/components/ui/sliding-number";
import { useModal, usePrices } from "@/hooks";
import { roundToN, satsToBtc } from "@/lib/utils";

interface CallWriteOptionSummaryProps {
  amountSats: number;
  premium: number;
  term: number;
  strikePercent: number;
}

export function CallWriteOptionSummary({
  amountSats,
  premium,
  term,
  strikePercent,
}: CallWriteOptionSummaryProps) {
  const { data: priceData } = usePrices();
  const btcPrice = priceData?.btc ?? 0;
  const t = useTranslations("Summary");
  const { openModal } = useModal();
  const premiumSats = Math.round(amountSats * (premium / 100));
  const premiumBtc = satsToBtc(premiumSats);
  const premiumUsd = roundToN(btcPrice * premiumBtc, 1);

  const apy = Math.round((premium / 100) * (365 / term) * 100);

  const premiumDisplay = Number(premiumBtc.toFixed(6));
  const amountBtc = satsToBtc(amountSats);
  const amountDisplay = Number(amountBtc.toFixed(6));
  const strikeUsd = Math.round(btcPrice * (1 + strikePercent / 100));

  const platformFeePercent = 20;

  const handleOpenBreakdown = () => {
    openModal(
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">{t("optionBreakdown")}</h3>
        <div className="space-y-2">
          <div className="text-sm space-y-2">
            <p className="text-muted-foreground leading-relaxed">
              {t("writeExplainer.intro", {
                amount: `₿${amountDisplay}`,
                premium: `₿${premiumDisplay}`,
                strike: `$${strikeUsd.toLocaleString()}`,
                term: `${term} ${term === 1 ? "day" : "days"}`,
              })}
            </p>

            <div className="pt-2 space-y-1.5">
              <div className="flex items-start gap-2">
                <span className="text-muted-foreground">•</span>
                <p className="text-muted-foreground flex-1">
                  <span className="font-medium text-foreground">{t("writeExplainer.ifBelow")}</span>{" "}
                  {t("writeExplainer.ifBelowDesc")}
                </p>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-muted-foreground">•</span>
                <p className="text-muted-foreground flex-1">
                  <span className="font-medium text-foreground">{t("writeExplainer.ifRises")}</span>{" "}
                  {t("writeExplainer.ifRisesDesc")}
                </p>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-muted-foreground">•</span>
                <p className="text-muted-foreground flex-1">
                  <span className="font-medium text-foreground">
                    {t("writeExplainer.platformFee")}
                  </span>{" "}
                  {t("writeExplainer.platformFeeDesc", { fee: platformFeePercent })}
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
        <div className="flex items-end gap-1">
          <p className=" text-muted-foreground">{t("premium")}</p>
          <div className="font-semibold flex items-center">
            <span>₿&nbsp;</span>
            <SlidingNumber value={premiumDisplay} />
            <div className="text-muted-foreground text-sm bg-muted px-1 rounded-full flex items-center font-medium ml-1">
              $<SlidingNumber value={premiumUsd} />
            </div>
          </div>
        </div>
        <div className="text-right flex items-end gap-1">
          <p className="text-muted-foreground">{t("apy")}</p>
          <div className=" font-semibold text-primary flex items-center justify-end">
            <SlidingNumber value={apy} />
            <span>%</span>
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

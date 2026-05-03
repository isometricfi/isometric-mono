"use client";

import { format } from "date-fns";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { SlidingNumber } from "@/components/ui/sliding-number";
import { useConfig, useModal, usePrices } from "@/hooks";
import { estimateExpiryDate } from "@/lib/expiry";
import { getStrikeUsd } from "@/lib/options-form";
import { basisPointsToPercent, formatUsd, satsToBtc } from "@/lib/utils";

interface CallBuyOptionSummaryProps {
  premiumAmountSats: number;
  quantitySats: number;
  leverage: number;
  term: number;
  strikePercent: number;
}

export function CallBuyOptionSummary({
  premiumAmountSats,
  quantitySats,
  leverage,
  term,
  strikePercent,
}: CallBuyOptionSummaryProps) {
  const tForms = useTranslations("Forms");
  const { data: priceData } = usePrices();
  const { data: config } = useConfig();
  const btcPrice = priceData?.btc ?? 0;
  const t = useTranslations("Summary");
  const { openModal } = useModal();

  const premiumSats = premiumAmountSats;
  const premiumBtc = satsToBtc(premiumSats);
  const maxProfitSats = Math.max(quantitySats - premiumSats, 0);
  const maxProfitBtc = satsToBtc(maxProfitSats);
  const maxProfitUsd = maxProfitBtc * btcPrice;
  const strikeUsd = getStrikeUsd(btcPrice, strikePercent);
  const strikeDisplay = `$${formatUsd(strikeUsd)}`;
  const premiumDisplay = Number(premiumBtc.toFixed(6));
  const maxProfitDisplay = Number(maxProfitBtc.toFixed(6));
  const leverageDisplay = leverage > 0 ? Number(leverage.toFixed(1)) : 0;
  const termLabel = tForms(term === 1 ? "day" : "days").toLowerCase();
  const expiryDisplay = format(estimateExpiryDate(term), "MMM d, yyyy 'at' HH:mm");

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
              {t.rich("buyExplainer.intro", {
                amount: `₿${premiumDisplay}`,
                leverage: leverageDisplay,
                strike: `$${formatUsd(strikeUsd)}`,
                term: `${term} ${termLabel}`,
                bold: (chunks) => <strong>{chunks}</strong>,
              })}
            </p>

            <div className="pt-2 space-y-1.5">
              <div className="flex items-start gap-2">
                <span className="text-muted-foreground">•</span>
                <p className="text-muted-foreground flex-1">
                  <span className="font-medium text-foreground">
                    {t("buyExplainer.ifRises", { strike: strikeDisplay })}
                  </span>{" "}
                  {t("buyExplainer.ifRisesDesc", { maxProfit: `₿${maxProfitDisplay}` })}
                </p>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-muted-foreground">•</span>
                <p className="text-muted-foreground flex-1">
                  <span className="font-medium text-foreground">
                    {t("buyExplainer.ifBelow", { strike: strikeDisplay })}
                  </span>{" "}
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
              <div className="flex items-start gap-2">
                <span className="text-muted-foreground">•</span>
                <p className="text-muted-foreground flex-1">
                  <span className="font-medium text-foreground">{t("expires")}:</span>{" "}
                  {expiryDisplay}
                </p>
              </div>
            </div>
          </div>
        </div>
        <Button asChild variant="outline" size="sm" className="w-full">
          <a href="https://docs.isometric.fi/" target="_blank" rel="noopener noreferrer">
            {t("viewDocs")}
          </a>
        </Button>
      </div>,
      false,
      undefined,
      true,
    );
  };

  return (
    <div className="border-border flex  w-full justify-between">
      <div className="flex items-center justify-between text-sm gap-3">
        <div className="rounded-lg bg-muted px-1.5 py-1">
          <p className="text-xs font-medium text-muted-foreground">{t("leverage")}</p>
          <div className="font-semibold flex items-center md:text-sm text-xs">
            <SlidingNumber value={leverageDisplay} />
            <span>x&nbsp;</span>
          </div>
        </div>
        <div className="rounded-lg bg-muted px-1.5 py-1">
          <p className="text-xs font-medium text-muted-foreground">{t("maxProfit")}</p>
          <div className="font-semibold flex items-center md:text-sm text-xs">
            <span>₿&nbsp;</span>
            <SlidingNumber value={maxProfitDisplay} />
            <div className="text-muted-foreground text-xs bg-background/60 px-1 rounded-sm flex items-center font-medium ml-1 tabular-nums">
              ${formatUsd(maxProfitUsd)}
            </div>
          </div>
        </div>
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={handleOpenBreakdown}
        className=" text-xs text-muted-foreground justify-between  px-2  md:h-11 h-10"
      >
        {t("terms")}
      </Button>
    </div>
  );
}

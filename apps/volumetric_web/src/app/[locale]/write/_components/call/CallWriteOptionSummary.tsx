"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { SlidingNumber } from "@/components/ui/sliding-number";
import { useConfig, useModal, usePrices } from "@/hooks";
import { getStrikeUsd } from "@/lib/options-form";
import { basisPointsToPercent, roundToN, satsToBtc } from "@/lib/utils";

interface CallWriteOptionSummaryProps {
  amountSats: number;
  competitivenessRankDisplay: string | null;
  earningsSats: number;
  term: number;
  strikePercent: number;
}

export function CallWriteOptionSummary({
  amountSats,
  competitivenessRankDisplay,
  earningsSats,
  term,
  strikePercent,
}: CallWriteOptionSummaryProps) {
  const tForms = useTranslations("Forms");
  const { data: priceData } = usePrices();
  const { data: config } = useConfig();
  const btcPrice = priceData?.btc ?? 0;
  const t = useTranslations("Summary");
  const { openModal } = useModal();
  const earningsBtc = satsToBtc(earningsSats);
  const earningsUsd = roundToN(btcPrice * earningsBtc, 1);
  const earningsDisplay = Number(earningsBtc.toFixed(6));
  const amountBtc = satsToBtc(amountSats);
  const amountDisplay = Number(amountBtc.toFixed(6));
  const strikeUsd = getStrikeUsd(btcPrice, strikePercent);
  const strikeDisplay = `$${strikeUsd.toLocaleString()}`;
  const termLabel = tForms(term === 1 ? "day" : "days").toLowerCase();

  const apyPercent = roundToN(
    amountSats > 0 && term > 0 ? (earningsSats / amountSats) * (365 / term) * 100 : 0,
    0,
  );

  const platformFeePercent = basisPointsToPercent(
    Number(config?.fees.premiumFeeBasisPoints ?? BigInt(0)),
  );

  const handleOpenBreakdown = () => {
    openModal(
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">{t("optionBreakdown")}</h3>
        <div className="space-y-2">
          <div className="text-sm space-y-2">
            <p className="text-muted-foreground leading-relaxed">
              {t.rich("writeExplainer.intro", {
                amount: `₿${amountDisplay}`,
                earnings: `₿${earningsDisplay}`,
                term: `${term} ${termLabel}`,
                bold: (chunks) => <strong>{chunks}</strong>,
              })}
            </p>

            <div className="pt-2 space-y-1.5">
              <div className="flex items-start gap-2">
                <span className="text-muted-foreground">•</span>
                <p className="text-muted-foreground flex-1">
                  <span className="font-medium text-foreground">
                    {t("writeExplainer.ifBelow", { strike: strikeDisplay })}
                  </span>{" "}
                  {t("writeExplainer.ifBelowDesc")}
                </p>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-muted-foreground">•</span>
                <p className="text-muted-foreground flex-1">
                  <span className="font-medium text-foreground">
                    {t("writeExplainer.ifRises", { strike: strikeDisplay })}
                  </span>{" "}
                  {t("writeExplainer.ifRisesDesc", { strike: strikeDisplay })}
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
          <p className="text-xs font-medium text-muted-foreground">{t("rank")}</p>
          {competitivenessRankDisplay ? (
            <div className="font-semibold flex items-center md:text-sm text-xs">
              {competitivenessRankDisplay}
            </div>
          ) : (
            <div className="text-muted-foreground text-xs">--</div>
          )}
        </div>
        <div className="rounded-lg bg-muted px-1.5 py-1">
          <p className="text-xs font-medium text-muted-foreground">{t("apy")}</p>
          <div className="font-semibold flex items-center md:text-sm text-xs">
            <SlidingNumber value={apyPercent} />
            <span className="text-xs ml-0.5">%</span>
          </div>
        </div>
        <div className="rounded-lg bg-muted px-1.5 py-1">
          <p className="text-xs font-medium text-muted-foreground">{t("youEarn")}</p>
          <div className="font-semibold flex items-center md:text-sm text-xs">
            <span>₿&nbsp;</span>
            <SlidingNumber value={earningsDisplay} />
            <div className="text-muted-foreground text-xs bg-background/60 px-1 rounded-sm flex items-center font-medium ml-1">
              $<SlidingNumber value={earningsUsd} />
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

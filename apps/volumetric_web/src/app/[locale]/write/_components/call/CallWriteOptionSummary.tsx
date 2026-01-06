"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { SlidingNumber } from "@/components/ui/sliding-number";
import { usePrices } from "@/hooks";
import { roundToN, satsToBtc } from "@/lib/utils";
import { CallWriteHowItWorksModal } from "./CallWriteHowItWorksModal";

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
  const premiumSats = Math.round(amountSats * (premium / 100));
  const premiumBtc = satsToBtc(premiumSats);
  const premiumUsd = roundToN(btcPrice * premiumBtc, 1);

  const apy = Math.round((premium / 100) * (365 / term) * 100);

  const premiumDisplay = Number(premiumBtc.toFixed(6));

  return (
    <div className="space-y-3 pt-4 border-t border-border">
      <div className="flex items-center justify-between">
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
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-3">
        <p className="text-[13px] text-muted-foreground/70">
          {t("writeDescription", { term, strikePercent })}
        </p>
        <CallWriteHowItWorksModal
          trigger={
            <Button variant="outline" size="sm" className="shrink-0 text-xs">
              {t("learn")}
            </Button>
          }
        />
      </div>
    </div>
  );
}

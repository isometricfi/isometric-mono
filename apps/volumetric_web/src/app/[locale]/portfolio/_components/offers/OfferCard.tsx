"use client";

import { Loader2, TrendingUp, Trophy } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ComponentPropsWithoutRef, Ref } from "react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { cn, formatBtcWithSymbolBigint, roundToN } from "@/lib/utils";
import type { HeadlineKey, OfferCardData } from "./_internal/use-offer-card-data";

interface OfferCardProps extends ComponentPropsWithoutRef<typeof Card> {
  data: OfferCardData;
  ref?: Ref<HTMLDivElement>;
}

const STATUS_KEY: Record<HeadlineKey, string> = {
  live: "live",
  partial: "partiallyFilled",
  processing: "processing",
  "below-min": "belowMin",
  filled: "filledStatus",
};

export function OfferCard({ data, className, ref, ...rest }: OfferCardProps) {
  const t = useTranslations("OfferCard");
  const {
    totalSats,
    remainingSats,
    filledPercent,
    strikeBpsPercent,
    premiumBpsPercent,
    strikePriceUsd,
    termDays,
    earningsBtc,
    apyPercent,
    rankInfo,
    headlineKey,
  } = data;

  const isProcessing = headlineKey === "processing";
  const isBelowMin = headlineKey === "below-min";
  const isFilled = headlineKey === "filled";
  const isHealthy = !isProcessing && !isBelowMin;

  return (
    <Card
      ref={ref}
      className={cn(
        "relative overflow-hidden transition-all hover:border-primary/50 h-fit cursor-pointer py-0 gap-0",
        className,
      )}
      {...rest}
    >
      <div className="px-4 pt-4 pb-3 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <Badge
            variant="outline"
            className={cn(
              "text-[10px] uppercase tracking-[0.12em] font-semibold",
              isFilled && "text-muted-foreground border-border/60",
              isHealthy && !isFilled && "text-green-500 border-green-500/40 bg-green-500/5",
              isBelowMin && "text-amber-500 border-amber-500/40 bg-amber-500/5",
              isProcessing && "text-primary border-primary/40 bg-primary/10 animate-pulse",
            )}
          >
            {isProcessing ? <Loader2 className="size-3 mr-1 animate-spin" /> : null}
            {t(STATUS_KEY[headlineKey])}
          </Badge>
          <div className="flex items-center gap-1.5">
            {rankInfo &&
              (rankInfo.isBest ? (
                <Badge variant="default" className="gap-1 text-[10px] uppercase tracking-[0.1em]">
                  <Trophy className="size-3" />
                  {t("bestOffer")}
                </Badge>
              ) : (
                <Badge
                  variant="outline"
                  className="text-muted-foreground gap-1 text-[10px] uppercase tracking-[0.1em]"
                >
                  {t("rank", { rank: rankInfo.rank })}
                </Badge>
              ))}
            <Badge variant="secondary" className="gap-1">
              <TrendingUp className="size-3" />
              <span className="uppercase text-[10px] tracking-[0.1em]">{t("call")}</span>
            </Badge>
          </div>
        </div>

        <div className="space-y-0.5">
          <div className="font-mono text-3xl tabular-nums leading-none">
            {roundToN(premiumBpsPercent, 2)}%
          </div>
          <div className="flex items-baseline justify-between gap-2 text-sm tabular-nums">
            <span className="font-mono text-muted-foreground">
              ₿{roundToN(earningsBtc, 6)}
              <span className="text-muted-foreground/50 mx-1.5">·</span>
              {roundToN(apyPercent, 0)}% {t("apyLabel")}
            </span>
            <span className="text-xs text-muted-foreground/70 font-mono">
              {strikePriceUsd
                ? `+${roundToN(strikeBpsPercent, 2)}% / $${roundToN(strikePriceUsd, 0).toLocaleString()}`
                : `+${roundToN(strikeBpsPercent, 2)}%`}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-muted-foreground pt-1 font-mono tabular-nums">
          <span>
            {formatBtcWithSymbolBigint(BigInt(remainingSats))} /{" "}
            {formatBtcWithSymbolBigint(BigInt(totalSats))}
          </span>
          <span>
            {termDays}d · {roundToN(filledPercent, 0)}%
          </span>
        </div>
      </div>

      <div
        className={cn("h-[3px] w-full", isProcessing ? "bg-muted animate-pulse" : "bg-muted/50")}
      >
        <div
          className={cn(
            "h-full transition-[width]",
            isFilled ? "bg-muted-foreground" : isBelowMin ? "bg-amber-500" : "bg-primary",
          )}
          style={{ width: `${filledPercent}%` }}
        />
      </div>
    </Card>
  );
}

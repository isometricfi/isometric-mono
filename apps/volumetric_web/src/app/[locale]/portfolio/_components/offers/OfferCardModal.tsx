"use client";

import { format } from "date-fns";
import { Loader2, Trash } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useMediaQuery } from "react-responsive";
import {
  FlowScenariosCard,
  FlowStepHeading,
  FlowSummaryCard,
  highlightTags,
  type Scenario,
  type SummaryRow,
} from "@/components/options/MobileFlowParts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { Progress } from "@/components/ui/progress";
import type { PortfolioOffer } from "@/hooks";
import { cn, formatBtcWithSymbol, formatBtcWithSymbolBigint, roundToN } from "@/lib/utils";
import {
  type OfferCardData,
  type RankInfo,
  useOfferCardData,
} from "./_internal/use-offer-card-data";
import { OfferCard } from "./OfferCard";

interface OfferCardModalProps {
  offer: PortfolioOffer;
  btcPrice: number;
  rankInfo?: RankInfo | null;
  onCancel?: (id: string) => void;
  isCancelling?: boolean;
}

export function OfferCardModal({
  offer,
  btcPrice,
  rankInfo,
  onCancel,
  isCancelling,
}: OfferCardModalProps) {
  const t = useTranslations("OfferCard");
  const [open, setOpen] = useState(false);
  const isMobile = useMediaQuery({ query: "(max-width: 768px)" });
  const data = useOfferCardData(offer, btcPrice, rankInfo);

  const trigger = <OfferCard data={data} />;
  const body = (
    <ModalBody offer={offer} data={data} onCancel={onCancel} isCancelling={isCancelling} />
  );
  const detailTitle = t("offer");

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerTrigger asChild>{trigger}</DrawerTrigger>
        <DrawerContent>
          <DrawerHeader className="sr-only">
            <DrawerTitle>{detailTitle}</DrawerTitle>
          </DrawerHeader>
          <div className="px-4 pb-6 pt-2">{body}</div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader className="sr-only">
          <DialogTitle>{detailTitle}</DialogTitle>
        </DialogHeader>
        {body}
      </DialogContent>
    </Dialog>
  );
}

function ModalBody({
  offer,
  data,
  onCancel,
  isCancelling,
}: {
  offer: PortfolioOffer;
  data: OfferCardData;
  onCancel?: (id: string) => void;
  isCancelling?: boolean;
}) {
  const t = useTranslations("OfferCard");
  const tSummary = useTranslations("Summary");
  const {
    totalSats,
    remainingSats,
    filledPercent,
    premiumBpsPercent,
    strikeBpsPercent,
    strikePriceUsd,
    termDays,
    earningsBtc,
    earningsUsd,
    earningsRemainingBtc,
    apyPercent,
    minAcceptOfferAmountSats,
    createdAt,
    validUntil,
    headlineKey,
    rankInfo,
  } = data;

  const eyebrowKey =
    headlineKey === "processing"
      ? "eyebrowProcessing"
      : headlineKey === "filled"
        ? "eyebrowFilled"
        : headlineKey === "partial"
          ? "eyebrowPartial"
          : "eyebrow";
  const eyebrow = t(eyebrowKey, {
    term: termDays,
    filled: roundToN(filledPercent, 0),
  });

  const strikeDisplay = strikePriceUsd
    ? `$${roundToN(strikePriceUsd, 0).toLocaleString()}`
    : `+${roundToN(strikeBpsPercent, 2)}%`;

  const title = t.rich("title", {
    ...highlightTags,
    quantity: formatBtcWithSymbolBigint(BigInt(totalSats)),
    strike: strikeDisplay,
    premium: `${roundToN(premiumBpsPercent, 2)}%`,
  });

  const scenarios: Scenario[] = [
    {
      condition: tSummary("writeExplainer.ifBelow", { strike: strikeDisplay }),
      outcome: tSummary("writeExplainer.ifBelowDesc"),
    },
    {
      condition: tSummary("writeExplainer.ifRises", { strike: strikeDisplay }),
      outcome: tSummary("writeExplainer.ifRisesDesc", { strike: strikeDisplay }),
    },
  ];

  const summaryRows: SummaryRow[] = [
    {
      label: t("totalSize"),
      value: formatBtcWithSymbolBigint(BigInt(totalSats)),
    },
    {
      label: t("remainingSize"),
      value: formatBtcWithSymbolBigint(BigInt(remainingSats)),
    },
    {
      label: t("strike"),
      value: strikePriceUsd
        ? `${strikeDisplay} (+${roundToN(strikeBpsPercent, 2)}%)`
        : `+${roundToN(strikeBpsPercent, 2)}%`,
    },
    {
      label: t("termLabel"),
      value: `${termDays} ${t("days")}`,
    },
    {
      label: t("earningsIfFilled"),
      value: `₿${roundToN(earningsBtc, 6)} · $${roundToN(earningsUsd, 2)}`,
      accent: true,
    },
    {
      label: t("earningsRemaining"),
      value: `₿${roundToN(earningsRemainingBtc, 6)}`,
    },
    {
      label: t("created"),
      value: format(createdAt, "MMM d, yyyy 'at' HH:mm"),
    },
    {
      label: t("validUntil"),
      value: format(validUntil, "MMM d, yyyy 'at' HH:mm"),
    },
    {
      label: t("offerId"),
      value: `#${offer.id.toString()}`,
    },
  ];

  const canCancel = onCancel && (offer.status === "Open" || offer.status === "PartiallyFilled");

  return (
    <div className="space-y-5">
      <FlowStepHeading eyebrow={eyebrow} title={title} />

      <HeroPremium
        premiumBpsPercent={premiumBpsPercent}
        earningsBtc={earningsBtc}
        earningsUsd={earningsUsd}
        apyPercent={apyPercent}
        rankInfo={rankInfo}
      />

      <div className="space-y-2 px-1">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground uppercase tracking-[0.12em] text-[10px]">
            {t("filled")}
          </span>
          <span className="font-mono tabular-nums">{roundToN(filledPercent, 0)}%</span>
        </div>
        <Progress value={filledPercent} className="h-1.5" />
      </div>

      {data.belowMinOfferAmount && (
        <Badge variant="destructive" className="w-full justify-center py-1.5">
          {t("remainingBelowMinimum", {
            amount: formatBtcWithSymbol(minAcceptOfferAmountSats),
          })}
        </Badge>
      )}

      <div className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground/70">
        {t("scenariosLabel")}
      </div>

      <FlowScenariosCard scenarios={scenarios} />

      <FlowSummaryCard rows={summaryRows} />

      {canCancel && (
        <Button
          variant="destructive"
          size="lg"
          className="w-full"
          disabled={isCancelling}
          onClick={() => onCancel(offer.id)}
        >
          {isCancelling ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              {t("cancelling")}
            </>
          ) : (
            <>
              <Trash className="size-4" />
              {t("cancelOffer")}
            </>
          )}
        </Button>
      )}
    </div>
  );
}

function HeroPremium({
  premiumBpsPercent,
  earningsBtc,
  earningsUsd,
  apyPercent,
  rankInfo,
}: {
  premiumBpsPercent: number;
  earningsBtc: number;
  earningsUsd: number;
  apyPercent: number;
  rankInfo: RankInfo | null;
}) {
  const t = useTranslations("OfferCard");

  return (
    <div className="flex flex-col items-center gap-2 py-2">
      <span className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground font-medium">
        {t("premiumLabel")}
      </span>
      <p className="text-[40px] leading-none font-bold tabular-nums">
        {roundToN(premiumBpsPercent, 2)}%
      </p>
      <p className="text-sm text-muted-foreground tabular-nums">
        <span className="font-mono">₿{roundToN(earningsBtc, 6)}</span>
        <span className="text-muted-foreground/60 mx-1.5">·</span>
        <span className="font-mono">${roundToN(earningsUsd, 2)}</span>
        <span className="text-muted-foreground/60 mx-1.5">·</span>
        <span className="font-mono">
          {roundToN(apyPercent, 0)}% {t("apyLabel")}
        </span>
      </p>
      {rankInfo ? (
        <Badge
          variant="outline"
          className={cn(
            "mt-1 text-[10px] uppercase tracking-[0.12em] font-semibold",
            rankInfo.isBest
              ? "text-primary border-primary/40 bg-primary/10"
              : "text-muted-foreground",
          )}
        >
          {rankInfo.isBest ? t("bestOffer") : t("rank", { rank: rankInfo.rank })}
        </Badge>
      ) : null}
    </div>
  );
}

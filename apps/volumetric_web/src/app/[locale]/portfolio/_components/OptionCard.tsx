"use client";

import { format, intervalToDuration, isPast } from "date-fns";
import { Eye, PenLine, ShoppingCart, TrendingUp } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useMediaQuery } from "react-responsive";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { Skeleton } from "@/components/ui/skeleton";
import type { PortfolioOption } from "@/hooks";
import { cn, formatBtcWithSymbolBigint, roundToN, SATS_PER_BTC } from "@/lib/utils";
import type { ViewerMode } from "@/types/ui";

interface OptionCardProps {
  option: PortfolioOption;
  btcPrice: number;
  role: ViewerMode;
}

function calculatePnL(
  option: PortfolioOption,
  currentPrice: number,
): { valueBtc: number; valueUsd: number; percent: number; isProfit: boolean } | null {
  if (currentPrice <= 0) return null;

  const strikePriceCents = Number(option.strikePriceCents);
  const premiumSats = Number(option.premiumPaid);
  const quantitySats = Number(option.quantity);

  const strikePriceUsd = strikePriceCents / 100;
  const premiumBtc = premiumSats / SATS_PER_BTC;
  const premiumUsd = premiumBtc * currentPrice;
  const quantityBtc = quantitySats / SATS_PER_BTC;

  if (option.status === "Active") {
    if (currentPrice > strikePriceUsd) {
      const maxPayoutBtc = quantityBtc;
      const maxPayoutUsd = maxPayoutBtc * currentPrice;
      const netPnL = maxPayoutUsd - premiumUsd;
      const netPnLBtc = netPnL / currentPrice;
      return {
        valueBtc: netPnLBtc,
        valueUsd: netPnL,
        percent: (netPnL / premiumUsd) * 100,
        isProfit: netPnL > 0,
      };
    }
    return {
      valueBtc: -premiumBtc,
      valueUsd: -premiumUsd,
      percent: -100,
      isProfit: false,
    };
  }

  // As a writer
  if (currentPrice > strikePriceUsd) {
    const maxPayoutBtc = quantityBtc;
    const maxPayoutUsd = maxPayoutBtc * currentPrice;
    const netPnL = premiumUsd - maxPayoutUsd;
    const netPnLBtc = netPnL / currentPrice;
    return {
      valueBtc: netPnLBtc,
      valueUsd: netPnL,
      percent: (netPnL / premiumUsd) * 100,
      isProfit: netPnL > 0,
    };
  }
  return {
    valueBtc: premiumBtc,
    valueUsd: premiumUsd,
    percent: 100,
    isProfit: true,
  };
}

function getTimeRemaining(
  expiryNs: bigint,
  acceptedAtNs: bigint,
  t: (key: string) => string,
): { text: string; isExpired: boolean; progressPercent: number; expiryDate: Date } {
  const expiryMs = Number(expiryNs / BigInt(1_000_000));
  const acceptedAtMs = Number(acceptedAtNs / BigInt(1_000_000));
  const expiryDate = new Date(expiryMs);
  const now = Date.now();

  const totalDuration = expiryMs - acceptedAtMs;
  const elapsed = now - acceptedAtMs;
  const progressPercent = Math.min(100, Math.max(0, (elapsed / totalDuration) * 100));

  if (isPast(expiryDate)) {
    return { text: t("expired"), isExpired: true, progressPercent: 100, expiryDate };
  }

  const duration = intervalToDuration({
    start: new Date(),
    end: expiryDate,
  });

  const parts: string[] = [];

  if (duration.days && duration.days > 0) {
    parts.push(`${duration.days}d`);
    if (duration.hours && duration.hours > 0) {
      parts.push(`${duration.hours}h`);
    }
  } else if (duration.hours && duration.hours > 0) {
    parts.push(`${duration.hours}h`);
    if (duration.minutes && duration.minutes > 0) {
      parts.push(`${duration.minutes}m`);
    }
  } else if (duration.minutes && duration.minutes > 0) {
    parts.push(`${duration.minutes}m`);
  } else {
    parts.push("<1m");
  }

  return { text: parts.join(" "), isExpired: false, progressPercent, expiryDate };
}

function OptionDetailContent({
  option,
  btcPrice,
  role,
  pnl,
  timeRemaining,
}: {
  option: PortfolioOption;
  btcPrice: number;
  role: ViewerMode;
  pnl: ReturnType<typeof calculatePnL>;
  timeRemaining: ReturnType<typeof getTimeRemaining>;
}) {
  const t = useTranslations("OptionCard");
  const strikePrice = Number(option.strikePriceCents) / 100;
  const entryPrice = Number(option.entryPriceCents) / 100;
  const premiumBtc = Number(option.premiumPaid) / SATS_PER_BTC;
  const quantityBtc = Number(option.quantity) / SATS_PER_BTC;

  const breakEvenPrice =
    role === "buyer"
      ? strikePrice + (premiumBtc / quantityBtc) * btcPrice
      : strikePrice - (premiumBtc / quantityBtc) * btcPrice;

  const priceToBreakEven = btcPrice > 0 ? ((breakEvenPrice - btcPrice) / btcPrice) * 100 : 0;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <div className="text-xs text-muted-foreground">{t("currentPrice")}</div>
          <div className="font-mono font-medium">${roundToN(btcPrice, 0).toLocaleString()}</div>
        </div>
        <div className="space-y-1">
          <div className="text-xs text-muted-foreground">{t("strikePrice")}</div>
          <div className="font-mono font-medium">${roundToN(strikePrice, 0).toLocaleString()}</div>
        </div>
        <div className="space-y-1">
          <div className="text-xs text-muted-foreground">{t("entryPrice")}</div>
          <div className="font-mono font-medium">${roundToN(entryPrice, 0).toLocaleString()}</div>
        </div>
        <div className="space-y-1">
          <div className="text-xs text-muted-foreground">{t("breakEven")}</div>
          <div className="font-mono font-medium">
            ${roundToN(breakEvenPrice, 0).toLocaleString()}
            <span
              className={cn(
                "text-xs ml-1",
                priceToBreakEven > 0 ? "text-red-500" : "text-green-500",
              )}
            >
              ({priceToBreakEven > 0 ? "+" : ""}
              {roundToN(priceToBreakEven, 1)}%)
            </span>
          </div>
        </div>
      </div>

      <div className="border-t pt-4 space-y-3">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">{t("quantity")}</span>
          <span className="font-mono">{formatBtcWithSymbolBigint(option.quantity)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">{t("premiumPaid")}</span>
          <span className="font-mono">₿{roundToN(premiumBtc, 6)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">{t("pnl")}</span>
          {pnl ? (
            <span className={cn("font-mono", pnl.isProfit ? "text-green-500" : "text-red-500")}>
              {pnl.isProfit ? "" : "-"}₿{roundToN(Math.abs(pnl.valueBtc), 6)} (
              {pnl.isProfit ? "" : "-"}${roundToN(Math.abs(pnl.valueUsd), 2)})
            </span>
          ) : (
            <Skeleton className="w-20 h-4" />
          )}
        </div>
      </div>

      <div className="border-t pt-4 space-y-3">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">{t("expiresAt")}</span>
          <span className="font-mono">
            {format(timeRemaining.expiryDate, "MMM d, yyyy 'at' HH:mm")}
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">{t("timeRemaining")}</span>
          <span className={cn("font-mono", timeRemaining.isExpired && "text-destructive")}>
            {timeRemaining.text}
          </span>
        </div>
        <div className="flex justify-between text-sm items-center">
          <span className="text-muted-foreground">{t("progress")}</span>
          <div className="flex items-center gap-2 w-1/2">
            <Progress value={timeRemaining.progressPercent} className="h-2" />
            <span className="text-xs text-muted-foreground">
              {roundToN(timeRemaining.progressPercent, 0)}%
            </span>
          </div>
        </div>
      </div>

      <div className="border-t pt-4">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">{t("optionId")}</span>
          <span className="font-mono text-xs text-muted-foreground">#{option.id.toString()}</span>
        </div>
      </div>
    </div>
  );
}

export function OptionCard({ option, btcPrice, role }: OptionCardProps) {
  const [open, setOpen] = useState(false);
  const isMobile = useMediaQuery({ query: "(max-width: 768px)" });
  const t = useTranslations("OptionCard");
  const timeRemaining = getTimeRemaining(option.expiry, option.acceptedAt, (key: string) => t(key));
  const pnl = calculatePnL(option, btcPrice);
  const strikePrice = Number(option.strikePriceCents) / 100;

  const cardContent = (
    <Card className="py-4 overflow-hidden transition-all hover:border-primary/50 h-fit ">
      <CardContent className="  space-y-3 w-full px-4">
        <div className="flex justify-between items-start">
          <div className="flex flex-col gap-1">
            <div className="text-lg font-mono font-medium">
              {formatBtcWithSymbolBigint(option.quantity)}
            </div>
          </div>
          <div className="text-right flex items-center gap-1.5">
            <Badge variant="outline" className="text-muted-foreground">
              {role === "buyer" ? (
                <>
                  <ShoppingCart className="size-3" />
                  <span>{t("buyer")}</span>
                </>
              ) : (
                <>
                  <PenLine className="size-3" />
                  <span>{t("writer")}</span>
                </>
              )}
            </Badge>
            <Badge variant="secondary">
              <TrendingUp className="size-3.5" />
              <span>{t("call")}</span>
            </Badge>
          </div>
        </div>

        {option.status === "Settling" ? (
          <Badge className=" text-base w-full flex items-center gap-2 justify-center animate-pulse">
            {t("expiredSettling")}
          </Badge>
        ) : (
          <div className="flex justify-between text-sm font-medium items-center gap-2 w-full">
            <span className="text-muted-foreground -mr-1">{t("expires")}</span>
            <span className="whitespace-nowrap">{timeRemaining.text}</span>

            <Progress value={timeRemaining.progressPercent} className="h-2" />
          </div>
        )}
        <div className="flex justify-between text-sm font-medium items-center gap-2">
          <div className="flex items-center gap-1">
            <span className="text-muted-foreground">{t("strike")}</span>
            <span>${roundToN(strikePrice, 0).toLocaleString()}</span>
          </div>
        </div>
        <div className="flex justify-between text-sm font-medium items-center gap-2">
          <div className="flex items-center gap-1">
            <span className="text-muted-foreground">{t("pnl")}</span>
            {pnl ? (
              <span className={cn("font-mono", pnl.isProfit ? "text-green-500" : "text-red-500")}>
                {pnl.isProfit ? "" : "-"}₿{roundToN(Math.abs(pnl.valueBtc), 5)}
              </span>
            ) : (
              <Skeleton className="w-10 h-4" />
            )}
          </div>

          <div>
            {pnl ? (
              <span className={cn("font-mono", pnl.isProfit ? "text-green-500" : "text-red-500")}>
                {pnl.isProfit ? "" : "-"}${roundToN(Math.abs(pnl.valueUsd), 2)}
              </span>
            ) : (
              <Skeleton className="w-10 h-4" />
            )}
          </div>
        </div>

        <div className="border-t pt-3">
          <Button variant="outline" size="sm" className="w-full">
            <Eye className="size-3.5" />
            {t("view")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  const detailTitle = role === "buyer" ? t("boughtCallOption") : t("writtenCallOption");

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerTrigger asChild>{cardContent}</DrawerTrigger>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>{detailTitle}</DrawerTitle>
          </DrawerHeader>
          <div className="px-4 pb-6">
            <OptionDetailContent
              option={option}
              btcPrice={btcPrice}
              role={role}
              pnl={pnl}
              timeRemaining={timeRemaining}
            />
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{cardContent}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{detailTitle}</DialogTitle>
        </DialogHeader>
        <OptionDetailContent
          option={option}
          btcPrice={btcPrice}
          role={role}
          pnl={pnl}
          timeRemaining={timeRemaining}
        />
      </DialogContent>
    </Dialog>
  );
}

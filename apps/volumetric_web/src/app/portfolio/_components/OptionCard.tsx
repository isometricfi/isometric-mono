"use client";

import type { ActiveOption } from "@volumetric/canister-types";
import { format, intervalToDuration, isPast } from "date-fns";
import { Eye, PenLine, ShoppingCart, TrendingUp } from "lucide-react";
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
import { getOptionStatusKey } from "@/lib/type-helpers";
import { centsToUsd, cn, formatBtcWithSymbol, nsToMs, roundToN, satsToBtc } from "@/lib/utils";
import type { ViewerMode } from "@/types/ui";

interface OptionCardProps {
  option: ActiveOption;
  btcPrice: number;
  role: ViewerMode;
}

function calculatePnL(
  option: ActiveOption,
  currentPrice: number,
): { valueBtc: number; valueUsd: number; percent: number; isProfit: boolean } | null {
  if (currentPrice <= 0) return null;

  const strikePriceUsd = centsToUsd(option.strike_price_cents);
  const premiumBtc = satsToBtc(option.premium_paid).toNumber();
  const premiumUsd = premiumBtc * currentPrice;
  const quantityBtc = satsToBtc(option.quantity).toNumber();

  const status = getOptionStatusKey(option.status);
  if (status === "Active") {
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
  expiry: bigint,
  acceptedAt: bigint,
): { text: string; isExpired: boolean; progressPercent: number; expiryDate: Date } {
  const expiryMs = nsToMs(expiry);
  const acceptedAtMs = nsToMs(acceptedAt);
  const expiryDate = new Date(expiryMs);
  const now = Date.now();

  const totalDuration = expiryMs - acceptedAtMs;
  const elapsed = now - acceptedAtMs;
  const progressPercent = Math.min(100, Math.max(0, (elapsed / totalDuration) * 100));

  if (isPast(expiryDate)) {
    return { text: "Expired", isExpired: true, progressPercent: 100, expiryDate };
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
  option: ActiveOption;
  btcPrice: number;
  role: ViewerMode;
  pnl: ReturnType<typeof calculatePnL>;
  timeRemaining: ReturnType<typeof getTimeRemaining>;
}) {
  const strikePrice = centsToUsd(option.strike_price_cents);
  const entryPrice = centsToUsd(option.entry_price_cents);
  const premiumBtc = satsToBtc(option.premium_paid).toNumber();
  const quantityBtc = satsToBtc(option.quantity).toNumber();

  const breakEvenPrice =
    role === "buyer"
      ? strikePrice + (premiumBtc / quantityBtc) * btcPrice
      : strikePrice - (premiumBtc / quantityBtc) * btcPrice;

  const priceToBreakEven = btcPrice > 0 ? ((breakEvenPrice - btcPrice) / btcPrice) * 100 : 0;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <div className="text-xs text-muted-foreground">Current Price</div>
          <div className="font-mono font-medium">${roundToN(btcPrice, 0).toLocaleString()}</div>
        </div>
        <div className="space-y-1">
          <div className="text-xs text-muted-foreground">Strike Price</div>
          <div className="font-mono font-medium">${roundToN(strikePrice, 0).toLocaleString()}</div>
        </div>
        <div className="space-y-1">
          <div className="text-xs text-muted-foreground">Entry Price</div>
          <div className="font-mono font-medium">${roundToN(entryPrice, 0).toLocaleString()}</div>
        </div>
        <div className="space-y-1">
          <div className="text-xs text-muted-foreground">Break Even</div>
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
          <span className="text-muted-foreground">Quantity</span>
          <span className="font-mono">{formatBtcWithSymbol(option.quantity)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Premium Paid</span>
          <span className="font-mono">₿{roundToN(premiumBtc, 6)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">PnL</span>
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
          <span className="text-muted-foreground">Expires</span>
          <span className="font-mono">
            {format(timeRemaining.expiryDate, "MMM d, yyyy 'at' HH:mm")}
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Time Remaining</span>
          <span className={cn("font-mono", timeRemaining.isExpired && "text-destructive")}>
            {timeRemaining.text}
          </span>
        </div>
        <div className="flex justify-between text-sm items-center">
          <span className="text-muted-foreground">Progress</span>
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
          <span className="text-muted-foreground">Option ID</span>
          <span className="font-mono text-xs text-muted-foreground">#{option.id.toString()}</span>
        </div>
      </div>
    </div>
  );
}

export function OptionCard({ option, btcPrice, role }: OptionCardProps) {
  const [open, setOpen] = useState(false);
  const isMobile = useMediaQuery({ query: "(max-width: 768px)" });
  const timeRemaining = getTimeRemaining(option.expiry, option.accepted_at);
  const pnl = calculatePnL(option, btcPrice);
  const strikePrice = centsToUsd(option.strike_price_cents);
  const status = getOptionStatusKey(option.status);

  const cardContent = (
    <Card className="overflow-hidden transition-all hover:border-primary/50">
      <CardContent className="p-4  space-y-3">
        <div className="flex justify-between items-start">
          <div className="flex flex-col gap-1">
            <div className="text-lg font-mono font-medium">
              {formatBtcWithSymbol(option.quantity)}
            </div>
          </div>
          <div className="text-right flex items-center gap-1.5">
            <Badge variant="outline" className="text-muted-foreground">
              {role === "buyer" ? (
                <>
                  <ShoppingCart className="size-3" />
                  <span>Buyer</span>
                </>
              ) : (
                <>
                  <PenLine className="size-3" />
                  <span>Writer</span>
                </>
              )}
            </Badge>
            <Badge variant="secondary">
              <TrendingUp className="size-3.5" />
              <span>Call</span>
            </Badge>
          </div>
        </div>

        {status === "Settling" ? (
          <Badge className=" text-base w-full flex items-center gap-2 justify-center animate-pulse">
            Expired: Now settling...
          </Badge>
        ) : (
          <div className="flex justify-between text-sm font-medium items-center gap-2 w-full">
            <span className="text-muted-foreground -mr-1">Expires:</span>
            <span className="whitespace-nowrap">{timeRemaining.text}</span>

            <Progress value={timeRemaining.progressPercent} className="h-2" />
          </div>
        )}
        <div className="flex justify-between text-sm font-medium items-center gap-2">
          <div className="flex items-center gap-1">
            <span className="text-muted-foreground">Strike:</span>
            <span>${roundToN(strikePrice, 0).toLocaleString()}</span>
          </div>
        </div>
        <div className="flex justify-between text-sm font-medium items-center gap-2">
          <div className="flex items-center gap-1">
            <span className="text-muted-foreground">PnL:</span>
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
            View
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  const detailTitle = `${role === "buyer" ? "Bought" : "Written"} Call Option`;

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

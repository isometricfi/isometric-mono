"use client";

import { format } from "date-fns";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useMediaQuery } from "react-responsive";
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
import { cn, formatBtcWithSymbolBigint, roundToN } from "@/lib/utils";
import type { ViewerMode } from "@/types/ui";
import { type OptionCardData, useOptionCardData } from "./_internal/use-option-card-data";
import { OptionCard } from "./OptionCard";

interface OptionCardModalProps {
  option: PortfolioOption;
  btcPrice: number;
  role: ViewerMode;
}

export function OptionCardModal({ option, btcPrice, role }: OptionCardModalProps) {
  const t = useTranslations("OptionCard");
  const [open, setOpen] = useState(false);
  const isMobile = useMediaQuery({ query: "(max-width: 768px)" });
  const data = useOptionCardData(option, btcPrice, role);
  const detailTitle = role === "buyer" ? t("boughtCallOption") : t("writtenCallOption");

  const trigger = <OptionCard option={option} role={role} data={data} />;
  const body = <ModalBody option={option} btcPrice={btcPrice} role={role} data={data} />;

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerTrigger asChild>{trigger}</DrawerTrigger>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>{detailTitle}</DrawerTitle>
          </DrawerHeader>
          <div className="px-4 pb-6">{body}</div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{detailTitle}</DialogTitle>
        </DialogHeader>
        {body}
      </DialogContent>
    </Dialog>
  );
}

function ModalBody({
  option,
  btcPrice,
  role,
  data,
}: {
  option: PortfolioOption;
  btcPrice: number;
  role: ViewerMode;
  data: OptionCardData;
}) {
  const t = useTranslations("OptionCard");
  const {
    pnl,
    timeRemaining,
    strikePrice,
    entryPrice,
    premiumSats,
    breakEvenPrice,
    priceToBreakEven,
  } = data;

  return (
    <div className="space-y-4">
      <div className={cn("grid grid-cols-2 gap-4", role === "writer" && "grid-cols-3")}>
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
        {breakEvenPrice !== null && priceToBreakEven !== null ? (
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
        ) : null}
      </div>

      <div className="border-t pt-4 space-y-3">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">{t("quantity")}</span>
          <span className="font-mono">{formatBtcWithSymbolBigint(option.quantity)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">
            {role === "buyer" ? t("premiumPaid") : t("premiumEarned")}
          </span>
          <span className="font-mono">{formatBtcWithSymbolBigint(premiumSats)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">{t("pnl")}</span>
          {pnl ? (
            <span className={cn("font-mono", pnl.isProfit ? "text-green-500" : "text-red-500")}>
              {formatBtcWithSymbolBigint(pnl.valueSats)} ({pnl.isProfit ? "" : "-"}$
              {roundToN(Math.abs(pnl.valueUsd), 2)})
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

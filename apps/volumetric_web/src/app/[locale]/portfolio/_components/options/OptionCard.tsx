"use client";

import { Eye, PenLine, ShoppingCart, TrendingUp } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ComponentPropsWithoutRef, Ref } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import type { PortfolioOption } from "@/hooks";
import { cn, formatBtcWithSymbolBigint, roundToN } from "@/lib/utils";
import type { ViewerMode } from "@/types/ui";
import type { OptionCardData } from "./_internal/use-option-card-data";

// Forwards extra props/ref onto Card so Radix Dialog/Drawer `asChild` triggers
// can attach their click handler when this component is the trigger child.
interface OptionCardProps extends ComponentPropsWithoutRef<typeof Card> {
  option: PortfolioOption;
  role: ViewerMode;
  data: OptionCardData;
  ref?: Ref<HTMLDivElement>;
}

export function OptionCard({ option, role, data, className, ref, ...rest }: OptionCardProps) {
  const t = useTranslations("OptionCard");
  const { pnl, timeRemaining, strikePrice } = data;

  return (
    <Card
      ref={ref}
      className={cn(
        "py-4 overflow-hidden transition-all hover:border-primary/50 h-fit cursor-pointer",
        className,
      )}
      {...rest}
    >
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
}

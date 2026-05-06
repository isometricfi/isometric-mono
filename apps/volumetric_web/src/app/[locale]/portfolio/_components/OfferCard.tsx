"use client";

import { Info, Loader2, MoreHorizontal, Pencil, Scale, Trash, Trophy } from "lucide-react";
import { useTranslations } from "next-intl";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Progress } from "@/components/ui/progress";
import { type PortfolioOffer, useConfig } from "@/hooks";
import {
  cn,
  DEFAULT_MIN_ACCEPT_OFFER_AMOUNT_SATS,
  formatBtcWithSymbol,
  formatBtcWithSymbolBigint,
  roundToN,
  secondsToDays,
} from "@/lib/utils";

interface OfferCardProps {
  offer: PortfolioOffer;
  btcPrice: number;
  availableBalanceSats?: bigint;
  onCancel?: (id: string) => void;
  isCancelling?: boolean;
  rankInfo?: {
    rank: number;
    totalOffers: number;
    isBest: boolean;
    isLargestInBook: boolean;
  } | null;
}

export function OfferCard({
  offer,
  btcPrice,
  availableBalanceSats,
  onCancel,
  isCancelling,
  rankInfo,
}: OfferCardProps) {
  const t = useTranslations("OfferCard");
  const remainingSats = offer.remainingQuantity;
  const totalSats = offer.totalQuantity;
  const filledAmount = totalSats - remainingSats;
  const filledPercent = totalSats > 0 ? (Number(filledAmount) / Number(totalSats)) * 100 : 0;
  const { data: config } = useConfig();
  const minAcceptOfferAmountSats =
    config?.minAcceptOfferAmountSats ?? DEFAULT_MIN_ACCEPT_OFFER_AMOUNT_SATS;
  const strikePrice = btcPrice > 0 ? btcPrice * (1 + offer.strikeBasisPoints / 10000) : null;
  const premiumSats = (Number(totalSats) * offer.premiumBasisPoints) / 10000;
  const belowMinOfferAmount = remainingSats < minAcceptOfferAmountSats;
  const effectiveRemainingSats =
    availableBalanceSats !== undefined && availableBalanceSats < remainingSats
      ? availableBalanceSats
      : remainingSats;
  const isUnderBacked =
    availableBalanceSats !== undefined && effectiveRemainingSats < remainingSats;
  const effectiveBelowMin = effectiveRemainingSats < BigInt(minAcceptOfferAmountSats);
  const showCancelOnly = belowMinOfferAmount || (isUnderBacked && effectiveBelowMin);

  return (
    <Card className={cn("overflow-hidden transition-all hover:border-primary/50 relative py-4")}>
      <CardContent className="px-4 space-y-3">
        {/* Header: Offer Amount & Remaining */}
        <div className="flex justify-between items-start">
          <div>
            <div className="text-xs text-muted-foreground ">{t("offer")}</div>
            <div className="text-lg font-mono font-medium">
              {formatBtcWithSymbolBigint(totalSats)}
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-muted-foreground ">{t("remaining")}</div>
            <div className="text-lg font-mono font-medium text-muted-foreground">
              {formatBtcWithSymbolBigint(remainingSats)}
            </div>
          </div>
        </div>

        {belowMinOfferAmount ? (
          <div className="-mt-1.5">
            <Badge variant={"destructive"} className="text-center w-full py-0">
              {t("remainingBelowMinimum", {
                amount: formatBtcWithSymbol(minAcceptOfferAmountSats),
              })}
            </Badge>
          </div>
        ) : (
          <div className="flex justify-between text-sm font-medium items-center gap-2 ">
            <span className="text-muted-foreground -mr-1">{t("filled")}</span>
            <span>{roundToN(filledPercent, 0)}%</span>
            <Progress value={filledPercent} className="h-2" />
          </div>
        )}

        {isUnderBacked && !belowMinOfferAmount && (
          <div className="-mt-1.5">
            <Badge variant={"destructive"} className="text-center w-full py-0">
              {effectiveBelowMin
                ? t("insufficientBackingShort")
                : t("insufficientBacking", {
                    effective: formatBtcWithSymbolBigint(effectiveRemainingSats),
                    remaining: formatBtcWithSymbolBigint(remainingSats),
                  })}
            </Badge>
          </div>
        )}

        <div className="flex justify-between text-sm font-medium items-center gap-2">
          <div className="flex items-center gap-1">
            <span className="text-muted-foreground ">{t("strike")} </span>
            <span>{offer.strikeBasisPoints / 100}%</span>
          </div>

          <div>{strikePrice ? `~$${roundToN(strikePrice, 0).toLocaleString()}` : "-"}</div>
        </div>
        <div className="flex justify-between text-sm font-medium items-center gap-2">
          <div className="flex items-center gap-1">
            <span className="text-muted-foreground ">{t("premium")} </span>
            <span>{offer.premiumBasisPoints / 100}%</span>
          </div>

          <div>{formatBtcWithSymbol(premiumSats, 6)}</div>
        </div>
        <div className="flex justify-between text-sm font-medium items-center gap-2">
          <div className="flex items-center gap-1">
            <span className="text-muted-foreground ">{t("term")} </span>
            <span>
              {secondsToDays(offer.optionDurationSeconds)} {t("days")}
            </span>
          </div>
        </div>

        {/* Footer: Type & Actions */}
        {showCancelOnly ? (
          <div className="flex items-center justify-between border-t pt-2">
            <Button
              className="w-full"
              size="sm"
              disabled={isCancelling}
              onClick={() => onCancel?.(offer.id.toString())}
            >
              {isCancelling ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  {t("cancelling")}
                </>
              ) : (
                <>
                  <Trash className="size-3.5" />
                  {t("cancelOffer")}
                </>
              )}
            </Button>
          </div>
        ) : (
          <div className="flex items-center justify-between border-t pt-2">
            <div className="flex items-center gap-2">
              {rankInfo && (
                <>
                  {rankInfo.isBest ? (
                    <Badge variant="default">
                      <Trophy className="size-3" />
                      {t("bestOffer")}
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="text-muted-foreground">
                      <Trophy className="size-3" />
                      {t("rank", { rank: rankInfo.rank })}
                    </Badge>
                  )}
                  {rankInfo.isLargestInBook && (
                    <Badge variant="secondary">
                      <Scale className="size-3" />
                      {t("largestOffer")}
                    </Badge>
                  )}
                </>
              )}
              <Dialog>
                <DialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-muted-foreground/50 hover:text-muted-foreground"
                  >
                    <Info className="size-3.5" />
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>{t("offerRanking")}</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-2">
                    <p className="text-sm text-muted-foreground">{t("rankingDescription")}</p>
                    <ol className="list-decimal list-inside text-sm space-y-2 ml-1">
                      <li className="font-medium text-foreground">
                        <span className="font-semibold">{t("lowestPremium")}</span>{" "}
                        <span className="text-muted-foreground font-normal">
                          {t("lowestPremiumDesc")}
                        </span>
                      </li>
                      <li className="font-medium text-foreground">
                        <span className="font-semibold">{t("earliestCreated")}</span>{" "}
                        <span className="text-muted-foreground font-normal">
                          {t("earliestCreatedDesc")}
                        </span>
                      </li>
                      <li className="font-medium text-foreground">
                        <span className="font-semibold">{t("largestSize")}</span>{" "}
                        <span className="text-muted-foreground font-normal">
                          {t("largestSizeDesc")}
                        </span>
                      </li>
                    </ol>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-foreground"
                  disabled={isCancelling}
                >
                  {isCancelling ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <MoreHorizontal className="size-4" />
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem disabled>
                  <Pencil className="size-3.5" />
                  {t("editOffer")}
                </DropdownMenuItem>
                {(offer.status === "Open" || offer.status === "PartiallyFilled") && onCancel && (
                  <DropdownMenuItem
                    className="text-destructive"
                    onClick={() => onCancel(offer.id)}
                    disabled={isCancelling}
                  >
                    {isCancelling ? (
                      <>
                        <Loader2 className="size-3.5 text-destructive animate-spin" />
                        {t("cancelling")}
                      </>
                    ) : (
                      <>
                        <Trash className="size-3.5 text-destructive" />
                        {t("cancelOffer")}
                      </>
                    )}
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

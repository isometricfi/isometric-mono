"use client";

import { Info, Loader2, MoreHorizontal, Pencil, Trash, TrendingUp, Trophy } from "lucide-react";
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
import type { PortfolioOffer } from "@/hooks";
import { formatBtcBigint, roundToN, SATS_PER_BTC, secondsToDays } from "@/lib/utils";

interface OfferCardProps {
  offer: PortfolioOffer;
  btcPrice: number;
  onCancel?: (id: string) => void;
  isCancelling?: boolean;
  rankInfo?: { rank: number; totalOffers: number; isBest: boolean } | null;
}

export function OfferCard({ offer, btcPrice, onCancel, isCancelling, rankInfo }: OfferCardProps) {
  const t = useTranslations("OfferCard");
  const remaining = Number(offer.remainingQuantity) / SATS_PER_BTC;
  const total = Number(offer.totalQuantity) / SATS_PER_BTC;
  const filledAmount = total - remaining;
  const filledPercent = total > 0 ? (filledAmount / total) * 100 : 0;

  const strikePrice = btcPrice > 0 ? btcPrice * (1 + offer.strikeBasisPoints / 10000) : null;

  const premiumBtc = (total * offer.premiumBasisPoints) / 10000;

  return (
    <Card className="overflow-hidden transition-all hover:border-primary/50 relative">
      <CardContent className="p-4 pb-3 space-y-3">
        {/* Header: Offer Amount & Remaining */}
        <div className="flex justify-between items-start">
          <div>
            <div className="text-xs text-muted-foreground ">{t("offer")}</div>
            <div className="text-lg font-mono font-medium">
              ₿{formatBtcBigint(offer.totalQuantity)}
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-muted-foreground ">{t("remaining")}</div>
            <div className="text-lg font-mono font-medium text-muted-foreground">
              ₿{formatBtcBigint(offer.remainingQuantity)}
            </div>
          </div>
        </div>

        <div className="flex justify-between text-sm font-medium items-center gap-2">
          <span className="text-muted-foreground -mr-1">{t("filled")}</span>
          <span>{roundToN(filledPercent, 0)}%</span>
          <Progress value={filledPercent} className="h-2" />
        </div>

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

          <div>₿{roundToN(premiumBtc, 5)}</div>
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
        <div className="flex items-center justify-between border-t pt-2">
          <div className="flex items-center gap-2">
            <Badge variant="secondary">
              <TrendingUp className="size-3.5" />
              <span>{t("call")}</span>
            </Badge>

            {rankInfo &&
              (rankInfo.isBest ? (
                <Badge
                  variant="default"
                  className="bg-yellow-500/15 text-yellow-600 hover:bg-yellow-500/25 border-yellow-500/20 gap-1 px-2"
                >
                  <Trophy className="size-3" />
                  {t("bestOffer")}
                </Badge>
              ) : (
                <Badge variant="outline" className="text-muted-foreground">
                  {t("rank", { rank: rankInfo.rank })}
                </Badge>
              ))}
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
                      {t("lowestPremiumDesc")}
                    </li>
                    <li className="font-medium text-foreground">
                      <span className="font-semibold">{t("largestSize")}</span>{" "}
                      {t("largestSizeDesc")}
                    </li>
                    <li className="font-medium text-foreground">
                      <span className="font-semibold">{t("earliestCreated")}</span>{" "}
                      {t("earliestCreatedDesc")}
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
      </CardContent>
    </Card>
  );
}

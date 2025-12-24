"use client";

import type { Offer } from "@volumetric/canister-types";
import { Info, Loader2, MoreHorizontal, Pencil, Trash, TrendingUp, Trophy } from "lucide-react";
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
import { getOfferStatusKey } from "@/lib/type-helpers";
import { formatBtc, roundToN, satsToBtc, secondsToDays } from "@/lib/utils";

interface OfferCardProps {
  offer: Offer;
  btcPrice: number;
  onCancel?: (id: bigint) => void;
  isCancelling?: boolean;
  rankInfo?: { rank: number; totalOffers: number; isBest: boolean } | null;
}

export function OfferCard({ offer, btcPrice, onCancel, isCancelling, rankInfo }: OfferCardProps) {
  const remaining = satsToBtc(offer.remaining_quantity).toNumber();
  const total = satsToBtc(offer.total_quantity).toNumber();
  const filledAmount = total - remaining;
  const filledPercent = total > 0 ? (filledAmount / total) * 100 : 0;

  const strikePrice = btcPrice > 0 ? btcPrice * (1 + offer.strike_basis_points / 10000) : null;

  const premiumBtc = (total * offer.premium_basis_points) / 10000;
  const status = getOfferStatusKey(offer.status);

  return (
    <Card className="overflow-hidden transition-all hover:border-primary/50 relative">
      <CardContent className="p-4 space-y-3">
        <div className="flex justify-between items-start">
          <div>
            <div className="text-xs text-muted-foreground ">Offer</div>
            <div className="text-lg font-mono font-medium">₿{formatBtc(offer.total_quantity)}</div>
          </div>
          <div className="text-right">
            <div className="text-xs text-muted-foreground ">Remaining</div>
            <div className="text-lg font-mono font-medium text-muted-foreground">
              ₿{formatBtc(offer.remaining_quantity)}
            </div>
          </div>
        </div>

        <div className="flex justify-between text-sm font-medium items-center gap-2">
          <span className="text-muted-foreground -mr-1">Filled:</span>
          <span>{roundToN(filledPercent, 0)}%</span>
          <Progress value={filledPercent} className="h-2" />
        </div>

        <div className="flex justify-between text-sm font-medium items-center gap-2">
          <div className="flex items-center gap-1">
            <span className="text-muted-foreground ">Strike: </span>
            <span>{offer.strike_basis_points / 100}%</span>
          </div>

          <div>{strikePrice ? `~$${roundToN(strikePrice, 0).toLocaleString()}` : "-"}</div>
        </div>
        <div className="flex justify-between text-sm font-medium items-center gap-2">
          <div className="flex items-center gap-1">
            <span className="text-muted-foreground ">Premium: </span>
            <span>{offer.premium_basis_points / 100}%</span>
          </div>

          <div>₿{roundToN(premiumBtc, 5)}</div>
        </div>
        <div className="flex justify-between text-sm font-medium items-center gap-2">
          <div className="flex items-center gap-1">
            <span className="text-muted-foreground ">Term: </span>
            <span>{secondsToDays(offer.option_duration_seconds)} days</span>
          </div>
        </div>

        <div className="flex items-center justify-between border-t pt-2">
          <div className="flex items-center gap-2">
            <Badge variant="secondary">
              <TrendingUp className="size-3.5" />
              <span>Call</span>
            </Badge>

            {rankInfo &&
              (rankInfo.isBest ? (
                <Badge
                  variant="default"
                  className="bg-yellow-500/15 text-yellow-600 hover:bg-yellow-500/25 border-yellow-500/20 gap-1 px-2"
                >
                  <Trophy className="size-3" />
                  Best Offer
                </Badge>
              ) : (
                <Badge variant="outline" className="text-muted-foreground">
                  Rank #{rankInfo.rank}
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
                  <DialogTitle>Offer Ranking</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-2">
                  <p className="text-sm text-muted-foreground">
                    Offers are ranked based on the following criteria, in order:
                  </p>
                  <ol className="list-decimal list-inside text-sm space-y-2 ml-1">
                    <li className="font-medium text-foreground">
                      <span className="font-semibold">Lowest Premium:</span> Buyers always prefer
                      the cheapest option for a given strike price.
                    </li>
                    <li className="font-medium text-foreground">
                      <span className="font-semibold">Largest Size:</span> Larger offers are
                      prioritized as they provide more liquidity.
                    </li>
                    <li className="font-medium text-foreground">
                      <span className="font-semibold">Earliest Created:</span> For identical offers,
                      the one created first gets priority (First-In-First-Out).
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
                Edit Offer
              </DropdownMenuItem>
              {(status === "Open" || status === "PartiallyFilled") && onCancel && (
                <DropdownMenuItem
                  className="text-destructive"
                  onClick={() => onCancel(offer.id)}
                  disabled={isCancelling}
                >
                  {isCancelling ? (
                    <>
                      <Loader2 className="size-3.5 text-destructive animate-spin" />
                      Cancelling...
                    </>
                  ) : (
                    <>
                      <Trash className="size-3.5 text-destructive" />
                      Cancel Offer
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

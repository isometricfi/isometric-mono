"use client";

import { PencilLine, Plus } from "lucide-react";
import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getOfferRank,
  type PortfolioOffer,
  useCancelOffer,
  useOptions,
  usePortfolio,
  usePrices,
} from "@/hooks";
import { OfferCard } from "./OfferCard";

export function OffersTable() {
  const { data: priceData } = usePrices();
  const { data: portfolio, isLoading } = usePortfolio();
  const { data: optionsData } = useOptions();
  const cancelOfferMutation = useCancelOffer();

  const currentBtcPrice = priceData?.btc ?? 0;

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-[259px] w-full rounded-xl" />
        ))}
      </div>
    );
  }

  const sortedOffers = [...(portfolio?.offers ?? [])].sort((a, b) => {
    const statusOrder: PortfolioOffer["status"][] = [
      "Open",
      "PartiallyFilled",
      "Processing",
      "Filled",
      "Cancelled",
    ];
    return statusOrder.indexOf(a.status) - statusOrder.indexOf(b.status);
  });

  if (sortedOffers.length === 0) {
    return (
      <div className="flex justify-center ">
        <div className=" text-center space-y-3 border rounded-xl p-5 max-w-lg w-full">
          <p className="text-lg">You have no active offers</p>

          <Link
            className="rounded-lg min-h-32 bg-muted text-muted-foreground flex items-center justify-center gap-2 hover:outline-[1px]"
            href="/write"
          >
            <PencilLine className="size-4" />
            Write options
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-4">
      {sortedOffers.map((offer) => {
        const term = Math.round(Number(offer.optionDurationSeconds) / 86400);

        const rankInfo = getOfferRank(
          optionsData,
          offer.id.toString(),
          term,
          offer.strikeBasisPoints / 100,
        );

        return (
          <OfferCard
            key={offer.id.toString()}
            offer={offer}
            btcPrice={currentBtcPrice}
            onCancel={(id) => cancelOfferMutation.mutate(id)}
            isCancelling={
              cancelOfferMutation.isPending &&
              cancelOfferMutation.variables?.toString() === offer.id.toString()
            }
            rankInfo={rankInfo}
          />
        );
      })}
      <Link
        className="rounded-lg min-h-[225px] bg-muted text-muted-foreground flex items-center justify-center gap-2 hover:outline-[1px]"
        href={"/write"}
      >
        <Plus className="size-4" />
        Create new offer
      </Link>
    </div>
  );
}

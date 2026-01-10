"use client";

import { PencilLine, ShoppingCart } from "lucide-react";
import { useTranslations } from "next-intl";
import { Skeleton } from "@/components/ui/skeleton";
import { type PortfolioOption, usePortfolio, usePrices } from "@/hooks";
import { Link } from "@/i18n/routing";
import { OptionCard } from "./OptionCard";

type OptionRole = "buyer" | "writer";
type OptionWithRole = PortfolioOption & { role: OptionRole };

export function OptionsTable() {
  const { data: portfolio, isLoading } = usePortfolio();
  const { data: priceData } = usePrices();
  const t = useTranslations("Portfolio");

  const currentBtcPrice = priceData?.btc ?? 0;

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-[200px] w-full rounded-xl" />
        ))}
      </div>
    );
  }

  const optionsWithRoles: OptionWithRole[] = [
    ...(portfolio?.boughtOptions ?? []).map((opt) => ({ ...opt, role: "buyer" as const })),
    ...(portfolio?.writtenOptions ?? []).map((opt) => ({ ...opt, role: "writer" as const })),
  ];

  const sortedOptions = [...optionsWithRoles].sort((a, b) => {
    if (a.status !== b.status) {
      return a.status === "Settling" ? -1 : 1;
    }
    return Number(a.expiry - b.expiry);
  });

  if (sortedOptions.length === 0) {
    return (
      <div className="flex justify-center mt-12 ">
        <div className=" text-center space-y-3 border rounded-xl p-5 max-w-lg w-full">
          <p className="text-lg">{t("noActiveOptions")}</p>
          <div className="grid grid-cols-2 gap-4 w-full">
            <Link
              className="rounded-lg min-h-32 bg-muted text-muted-foreground flex items-center justify-center gap-2 hover:outline-[1px]"
              href="/write"
            >
              <PencilLine className="size-4" />
              {t("writeOptions")}
            </Link>
            <Link
              className="rounded-lg min-h-32 bg-muted text-muted-foreground flex items-center justify-center gap-2 hover:outline-[1px]"
              href="/buy"
            >
              <ShoppingCart className="size-4" />
              {t("buyOptions")}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {sortedOptions.map((option) => (
        <OptionCard
          key={`${option.role}-${option.id.toString()}`}
          option={option}
          btcPrice={currentBtcPrice}
          role={option.role}
        />
      ))}
      <Link
        className="rounded-lg min-h-[213px] bg-muted text-muted-foreground flex items-center justify-center gap-2 hover:outline-[1px]"
        href="/buy"
      >
        <ShoppingCart className="size-4" />
        {t("buyNewOptions")}
      </Link>
    </div>
  );
}

"use client";

import { useTranslations } from "next-intl";
import { NumberCarousel } from "@/components/ui/number-carousel";
import { Skeleton } from "@/components/ui/skeleton";

interface WriteEarningsSectionProps {
  onPremiumPercentChange: (premiumPercent: number) => void;
  premiumPercent: number;
  premiumValues: number[];
}

export function WriteEarningsSection({
  onPremiumPercentChange,
  premiumPercent,
  premiumValues,
}: WriteEarningsSectionProps) {
  const t = useTranslations("Forms");

  if (premiumValues.length === 0) {
    return <Skeleton className="h-[52px] w-full" />;
  }

  return (
    <div className="flex items-center justify-between p-1 rounded-lg border">
      <p className="text-base font-medium text-foreground ml-2">{t("premium")}: </p>
      <div className="min-w-[200px]">
        <NumberCarousel
          values={premiumValues}
          value={premiumPercent}
          onChange={onPremiumPercentChange}
          formatValue={(value) => `${value}%`}
        />
      </div>
    </div>
  );
}

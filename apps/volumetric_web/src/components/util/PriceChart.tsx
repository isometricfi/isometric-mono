import { useTranslations } from "next-intl";

interface PriceChartProps {
  className?: string;
}

export function PriceChart({ className }: PriceChartProps) {
  const t = useTranslations("Components");

  return (
    <div className={`bg-card rounded-3xl border border-border overflow-hidden ${className ?? ""}`}>
      <div className="w-full h-full min-h-[400px] flex items-center justify-center">
        <div className="text-center space-y-2">
          <div className="text-muted-foreground text-sm">{t("btcUsdPriceChart")}</div>
          <div className="text-xs text-muted-foreground/60">{t("chartComingSoon")}</div>
        </div>
      </div>
    </div>
  );
}

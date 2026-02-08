"use client";

import { useTranslations } from "next-intl";

export function YieldDisplay() {
  const t = useTranslations("Landing");

  return (
    <div className="relative">
      <div className="relative">
        <div className="relative ">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">
                {t("activePosition")}
              </span>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-primary/10 text-primary">
              {t("call")}
            </span>
          </div>

          <div className="text-center mb-6">
            <div className="text-xs font-mono text-muted-foreground mb-1">{t("estimatedApy")}</div>
            <div className="text-5xl font-mono font-bold text-primary">
              250<span className="text-2xl text-primary/60">%</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-card rounded-xl p-5">
              <div className="text-[10px] font-mono text-muted-foreground mb-1">
                {t("collateral")}
              </div>
              <div className="text-sm font-mono font-semibold">1.0 BTC</div>
            </div>
            <div className="bg-card rounded-xl p-5">
              <div className="text-[10px] font-mono text-muted-foreground mb-1">{t("premium")}</div>
              <div className="text-sm font-mono font-semibold text-green-500">+0.021 BTC</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

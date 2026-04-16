"use client";

import { useTranslations } from "next-intl";

export function YieldDisplay() {
  const t = useTranslations("Landing");

  return (
    <div className="relative">
      <div className="relative">
        <div className="relative ">
          <div className="text-center mb-6">
            <div className="text-xs font-mono text-muted-foreground mb-1">{t("yieldApy")}</div>
            <div className="text-5xl font-mono font-bold text-primary">
              250<span className="text-2xl text-primary/60">%</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-card rounded-xl p-5">
              <div className="text-[10px] font-mono text-muted-foreground mb-1">{t("locked")}</div>
              <div className="text-sm font-mono font-semibold">1.0 BTC</div>
            </div>
            <div className="bg-card rounded-xl p-5">
              <div className="text-[10px] font-mono text-muted-foreground mb-1">{t("earned")}</div>
              <div className="text-sm font-mono font-semibold text-green-500">+0.0243 BTC</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useTranslations } from "next-intl";
import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ProceduralAvatar } from "@/components/wallet/ProceduralAvatar";
import { useAccount, useHistory, useModal } from "@/hooks";
import { formatBtcWithSymbolBigint } from "@/lib/utils";
import { ShareSummaryModal } from "./ShareSummaryModal";

export function HistoryStats() {
  const { data: history, isLoading } = useHistory();
  const { data: account } = useAccount();
  const { openModal } = useModal();
  const t = useTranslations("History");

  const stats = useMemo(() => {
    const entries = history?.entries ?? [];
    if (entries.length === 0) return null;

    const totalPnlSats = entries.reduce((sum, e) => sum + e.pnlSats, BigInt(0));
    const profitableTrades = entries.filter((e) => e.result === "profit").length;
    const winRate = (profitableTrades / entries.length) * 100;

    const bestTrade = entries.reduce(
      (best, e) => (e.pnlSats > best.pnlSats ? e : best),
      entries[0],
    );
    const worstTrade = entries.reduce(
      (worst, e) => (e.pnlSats < worst.pnlSats ? e : worst),
      entries[0],
    );

    const totalVolumeSats = entries.reduce((sum, e) => sum + e.quantitySats, BigInt(0));

    return {
      totalPnlSats,
      totalTrades: entries.length,
      winRate,
      profitableTrades,
      bestTradeSats: bestTrade.pnlSats,
      worstTradeSats: worstTrade.pnlSats,
      totalVolumeSats,
    };
  }, [history?.entries]);

  if (isLoading) {
    return <Skeleton className="h-[102px] w-full lg:h-[58px]" />;
  }

  if (!stats) return null;

  const statSection = (
    <div className="grid grid-cols-3 lg:grid-cols-4 gap-2">
      <div className=" px-2">
        <p className="text-xs text-muted-foreground">{t("pnl")}</p>
        <p className="md:text-sm text-xs font-bold">
          {formatBtcWithSymbolBigint(stats.totalPnlSats, 6)}
        </p>
      </div>
      <div className=" border-l px-2">
        <p className="text-xs text-muted-foreground">{t("winRate")}</p>
        <p className="md:text-sm text-xs font-bold">{stats.winRate.toFixed(1)}%</p>
      </div>
      <div className=" border-l px-2">
        <p className="text-xs text-muted-foreground">{t("volume")}</p>
        <p className="md:text-sm text-xs font-bold">
          {formatBtcWithSymbolBigint(stats.totalVolumeSats, 5)}
        </p>
      </div>
      <div className=" border-l px-2 lg:block hidden">
        <p className="text-xs text-muted-foreground">{t("trades")}</p>
        <p className="md:text-sm text-xs font-bold">{stats.totalTrades}</p>
      </div>
    </div>
  );
  return (
    <div className=" w-full bg border bg-muted rounded-lg lg:space-y-0 space-y-3 lg:rounded-full p-3">
      <div className="flex items-center gap-5 justify-between w-full">
        <div className="flex gap-2 items-center font-medium">
          <ProceduralAvatar
            seed={account?.profile?.address ?? ""}
            className="size-8 rounded-full"
          />
          {account?.profile?.username ?? `${t("user")} ${account?.profile?.principal.slice(0, 6)}`}
        </div>
        <div className="absolute left-1/2 -translate-x-1/2 lg:block hidden">{statSection}</div>
        <Button variant="outline" size="sm" onClick={() => openModal(<ShareSummaryModal />, false)}>
          {t("share")}
        </Button>
      </div>
      <div className="lg:hidden block">{statSection}</div>
    </div>
  );
}

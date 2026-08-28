"use client";

import { useTranslations } from "next-intl";
import { useAccount } from "@/hooks";
import { HistoryStats } from "./HistoryStats";
import { HistoryTable } from "./HistoryTable";

export function HistoryView() {
  const { data: account, isFetched } = useAccount();
  const t = useTranslations("History");

  if (isFetched && !account?.profile) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <p className="text-muted-foreground">{t("createAccount")}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 items-center">
      <div className="text-center space-y-2">
        <h1 className="md:text-3xl text-xl font-bold">{t("tradingHistory")}</h1>
      </div>
      <HistoryStats />
      <HistoryTable />
    </div>
  );
}

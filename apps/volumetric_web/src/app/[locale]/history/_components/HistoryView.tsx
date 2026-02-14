"use client";

import { useDynamicContext } from "@dynamic-labs/sdk-react-core";
import { useTranslations } from "next-intl";
import { ConnectButton } from "@/components/wallet/ConnectButton";
import { useAccount } from "@/hooks";
import { HistoryStats } from "./HistoryStats";
import { HistoryTable } from "./HistoryTable";

export function HistoryView() {
  const { primaryWallet } = useDynamicContext();
  const { data: account, isFetched } = useAccount();
  const t = useTranslations("History");

  if (!primaryWallet) {
    return (
      <div className="flex flex-col items-center justify-center gap-4">
        <div className="text-center space-y-2">
          <h1 className="md:text-3xl text-xl font-bold">{t("title")}</h1>
        </div>
        <p className="text-muted-foreground">{t("connectToView")}</p>
        <ConnectButton />
      </div>
    );
  }

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

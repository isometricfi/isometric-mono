"use client";

import { useDynamicContext } from "@dynamic-labs/sdk-react-core";
import { History, PencilLine, Zap } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { AnimatedToggle } from "@/components/navigation/AnimatedToggle";
import { Button } from "@/components/ui/button";
import { ConnectButton } from "@/components/wallet/ConnectButton";
import { useAccount } from "@/hooks";
import { Link } from "@/i18n/routing";
import { OffersTable } from "./OffersTable";
import { OptionsTable } from "./OptionsTable";

type TabValue = "offers" | "options";

export function PortfolioView() {
  const { primaryWallet } = useDynamicContext();
  const { data: account, isFetched } = useAccount();
  const [activeTab, setActiveTab] = useState<TabValue>("offers");
  const t = useTranslations("Portfolio");

  if (!primaryWallet) {
    return (
      <div className="flex flex-col items-center justify-center gap-4">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold">{t("title")}</h1>
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
    <div className="flex flex-col gap-4 relative">
      <div className="text-center space-y-2 flex justify-center gap-2">
        <h1 className="text-3xl font-bold">{t("title")}</h1>
        <Link href="/history" className="md:absolute right-0">
          <Button variant="outline" size="sm">
            <History className="size-4 " /> {t("history")}
          </Button>
        </Link>
      </div>

      <div className="flex flex-col gap-7">
        <div className="flex justify-center">
          <AnimatedToggle
            options={[
              { value: "offers", label: t("offers"), icon: PencilLine },
              { value: "options", label: t("options"), icon: Zap },
            ]}
            value={activeTab}
            onChange={setActiveTab}
            layoutId="portfolioTab"
          />
        </div>

        {activeTab === "options" && <OptionsTable />}
        {activeTab === "offers" && <OffersTable />}
      </div>
    </div>
  );
}

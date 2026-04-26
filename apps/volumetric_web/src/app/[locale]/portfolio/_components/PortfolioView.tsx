"use client";

import { useDynamicContext } from "@dynamic-labs/sdk-react-core";
import { History, PencilLine, Zap } from "lucide-react";
import { useTranslations } from "next-intl";
import { AnimatedToggle } from "@/components/navigation/AnimatedToggle";
import { Button } from "@/components/ui/button";
import { ConnectButton } from "@/components/wallet/ConnectButton";
import { useAccount } from "@/hooks";
import { Link } from "@/i18n/routing";
import { usePortfolioTab } from "@/stores/preferences-store";
import { OffersTable } from "./OffersTable";
import { OptionsTable } from "./OptionsTable";

export function PortfolioView() {
  const { primaryWallet } = useDynamicContext();
  const { data: account, isFetched } = useAccount();
  const { portfolioTab, setPortfolioTab } = usePortfolioTab();
  const t = useTranslations("Portfolio");

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
    <div className="flex flex-col gap-4 relative">
      <div className="flex justify-between items-center">
        <div className="flex justify-center items-center gap-2">
          <h1 className="md:text-3xl text-xl font-bold">{t("title")}</h1>
          <Link href="/history" className="">
            <Button variant="outline" size="sm">
              <History className="size-4 " />{" "}
              <span className="md:block hidden">{t("history")}</span>
            </Button>
          </Link>
        </div>
        <AnimatedToggle
          options={[
            { value: "offers", label: t("offers"), icon: PencilLine },
            { value: "options", label: t("options"), icon: Zap },
          ]}
          value={portfolioTab}
          onChange={setPortfolioTab}
          layoutId="portfolioTab"
        />
      </div>

      <div className="flex flex-col gap-7">
        {portfolioTab === "options" && <OptionsTable />}
        {portfolioTab === "offers" && <OffersTable />}
      </div>
    </div>
  );
}

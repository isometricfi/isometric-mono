"use client";

import { useDynamicContext } from "@dynamic-labs/sdk-react-core";
import { HelpCircle, TrendingUp, Wallet, Zap } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { BTCPriceChart } from "@/components/options/BTCPriceChart";
import { OptionsViewer } from "@/components/options/OptionsViewer";
import { OptionTypeToggle } from "@/components/options/OptionTypeToggle";
import { Button } from "@/components/ui/button";
import { DepositModal } from "@/components/wallet/DepositModal";
import { OnboardingContent } from "@/components/wallet/OnboardingModal";
import { useModal } from "@/hooks";
import { useProMode } from "@/stores/preferences-store";
import type { OptionType } from "@/types/ui";
import { BuyCallFlow } from "./call/BuyCallFlow";
import { CallOptionBuyForm } from "./call/CallOptionBuyForm";

export function BuyOptionsView() {
  const t = useTranslations("Pages");
  const [optionType, setOptionType] = useState<OptionType>("call");
  const [flowOpen, setFlowOpen] = useState(false);
  const [depositModalOpen, setDepositModalOpen] = useState(false);
  const { openModal } = useModal();
  const { isProMode } = useProMode();
  const { primaryWallet, setShowAuthFlow } = useDynamicContext();
  const isConnected = !!primaryWallet;
  const handleRequestDeposit = () => {
    setFlowOpen(false);
    setDepositModalOpen(true);
  };

  const isPutDisabled = optionType === "put";

  return (
    <>
      <div className="mb-6">
        <div className="flex justify-between items-center">
          <div className="flex items-center justify-center md:gap-1">
            <h1 className="md:text-2xl text-xl font-bold">{t("buyOptions")}</h1>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => openModal(<OnboardingContent />, false, "600px")}
              className="size-8 -mb-1"
            >
              <HelpCircle className="size-4" />
            </Button>
          </div>
          <div className="flex justify-center">
            <OptionTypeToggle value={optionType} onChange={setOptionType} />
          </div>
        </div>
        <p className="text-sm text-muted-foreground max-w-xl md:block hidden">
          {t("buyOptionsDescription")}
        </p>
        <div className="text-xs text-muted-foreground mt-4 bg-muted py-2 px-3 rounded-xl flex items-center gap-3 md:hidden">
          <Zap className="min-w-5" />
          {t("buyOptionsDescription")}
        </div>
      </div>

      {isPutDisabled && (
        <div className="text-center py-12">
          <p className="text-muted-foreground">{t("putsComingSoon")}</p>
        </div>
      )}

      {!isPutDisabled &&
        (isProMode ? (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <CallOptionBuyForm />
              <BTCPriceChart mode="buyer" />
            </div>
            <OptionsViewer mode="buyer" />
          </div>
        ) : (
          <div className="space-y-6">
            <div className="relative">
              <BTCPriceChart mode="buyer" showStrikeOverlay={false} termDaysOverride={14} />
              <Button
                onClick={() => (isConnected ? setFlowOpen(true) : setShowAuthFlow(true))}
                size={"lg"}
                className="absolute bottom-5 right-4.5 md:flex hidden"
              >
                {isConnected ? <TrendingUp className="size-5" /> : <Wallet className="size-5" />}
                {isConnected ? t("buyCta") : t("connectToBuyCta")}
              </Button>
              <Button
                onClick={() => (isConnected ? setFlowOpen(true) : setShowAuthFlow(true))}
                className="w-full mt-5 md:hidden"
              >
                {isConnected ? <TrendingUp className="size-5" /> : <Wallet className="size-5" />}
                {isConnected ? t("buyCta") : t("connectToBuyCta")}
              </Button>
            </div>
            <OptionsViewer mode="buyer" />
            {flowOpen && (
              <BuyCallFlow
                open={flowOpen}
                onOpenChange={setFlowOpen}
                onRequestDeposit={handleRequestDeposit}
              />
            )}
          </div>
        ))}
      <DepositModal open={depositModalOpen} onOpenChange={setDepositModalOpen} />
    </>
  );
}

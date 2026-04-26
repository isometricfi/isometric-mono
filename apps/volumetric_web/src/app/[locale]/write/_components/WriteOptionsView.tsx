"use client";

import { useDynamicContext } from "@dynamic-labs/sdk-react-core";
import { HelpCircle, PencilLine, PiggyBankIcon, Wallet } from "lucide-react";
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
import { CallWriteOptionForm } from "./call/CallWriteOptionForm";
import { WriteCallFlow } from "./call/WriteCallFlow";

export function WriteOptionsView() {
  const t = useTranslations("Pages");
  const [optionType, setOptionType] = useState<OptionType>("call");
  const [flowOpen, setFlowOpen] = useState(false);
  const [depositModalOpen, setDepositModalOpen] = useState(false);
  const { openModal } = useModal();
  const { isProMode } = useProMode();
  const { primaryWallet, setShowAuthFlow } = useDynamicContext();
  const isConnected = !!primaryWallet;
  const handleCtaClick = () => (isConnected ? setFlowOpen(true) : setShowAuthFlow(true));
  const handleRequestDeposit = () => {
    setFlowOpen(false);
    setDepositModalOpen(true);
  };
  const ctaLabel = isConnected ? t("writeCta") : t("connectToWriteCta");

  const isPutDisabled = optionType === "put";

  return (
    <>
      <div className="mb-6">
        <div className="flex justify-between items-center">
          <div className="flex items-center justify-center md:gap-1">
            <h1 className="md:text-2xl text-xl font-bold">{t("writeOptions")}</h1>
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
          {t("writeOptionsDescription")}
        </p>
        <div className="text-xs text-muted-foreground mt-4 bg-muted py-2 px-3 rounded-xl flex items-center gap-3 md:hidden">
          <PiggyBankIcon className="min-w-5" />
          {t("writeOptionsDescription")}
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
              <CallWriteOptionForm />
              <BTCPriceChart mode="writer" />
            </div>
            <OptionsViewer mode="writer" />
          </div>
        ) : (
          <div className="space-y-6">
            <div className="relative">
              <BTCPriceChart mode="writer" showStrikeOverlay={false} termDaysOverride={14} />
              <Button
                onClick={handleCtaClick}
                size={"lg"}
                className="absolute bottom-5 right-4.5 md:flex hidden"
              >
                {isConnected ? <PencilLine className="size-4" /> : <Wallet className="size-4" />}
                {ctaLabel}
              </Button>
              <Button onClick={handleCtaClick} className="w-full mt-5 md:hidden">
                {isConnected ? <PencilLine className="size-4" /> : <Wallet className="size-4" />}
                {ctaLabel}
              </Button>
            </div>
            <OptionsViewer mode="writer" />
            {flowOpen && (
              <WriteCallFlow
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

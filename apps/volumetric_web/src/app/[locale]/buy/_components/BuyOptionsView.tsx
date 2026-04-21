"use client";

import { HelpCircle, TrendingUp } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useMediaQuery } from "react-responsive";
import { BTCPriceChart } from "@/components/options/BTCPriceChart";
import { OptionsViewer } from "@/components/options/OptionsViewer";
import { OptionTypeToggle } from "@/components/options/OptionTypeToggle";
import { Button } from "@/components/ui/button";
import { OnboardingContent } from "@/components/wallet/OnboardingModal";
import { useModal } from "@/hooks";
import type { OptionType } from "@/types/ui";
import { CallOptionBuyForm } from "./call/CallOptionBuyForm";
import { MobileBuyCallFlow } from "./call/MobileBuyCallFlow";

export function BuyOptionsView() {
  const t = useTranslations("Pages");
  const [optionType, setOptionType] = useState<OptionType>("call");
  const [flowOpen, setFlowOpen] = useState(false);
  const { openModal } = useModal();
  const isMobile = useMediaQuery({ query: "(max-width: 768px)" });

  const isPutDisabled = optionType === "put";

  return (
    <>
      <div className="text-center mb-6 flex justify-between items-center">
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

      {isPutDisabled && (
        <div className="text-center py-12">
          <p className="text-muted-foreground">{t("putsComingSoon")}</p>
        </div>
      )}

      {!isPutDisabled && (
        <>
          {isMobile ? (
            <>
              <div className="mb-6">
                <Button
                  onClick={() => setFlowOpen(true)}
                  className="w-full h-12 text-base font-semibold shadow-lg shadow-primary/20"
                >
                  <TrendingUp className="size-5" />
                  {t("buyCta")}
                </Button>
              </div>

              <OptionsViewer mode="buyer" />

              {flowOpen && <MobileBuyCallFlow open={flowOpen} onOpenChange={setFlowOpen} />}
            </>
          ) : (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <CallOptionBuyForm />
                <BTCPriceChart mode="buyer" />
              </div>
              <OptionsViewer mode="buyer" />
            </div>
          )}
        </>
      )}
    </>
  );
}

"use client";

import { HelpCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { BTCPriceChart } from "@/components/options/BTCPriceChart";
import { OptionsViewer } from "@/components/options/OptionsViewer";
import { OptionTypeToggle } from "@/components/options/OptionTypeToggle";
import { Button } from "@/components/ui/button";
import { OnboardingContent } from "@/components/wallet/OnboardingModal";
import { useModal } from "@/hooks";
import type { OptionType } from "@/types/ui";
import { CallOptionBuyForm } from "./call/CallOptionBuyForm";

export function BuyOptionsView() {
  const t = useTranslations("Pages");
  const [optionType, setOptionType] = useState<OptionType>("call");
  const { openModal } = useModal();

  const isPutDisabled = optionType === "put";

  return (
    <>
      <div className="text-center  mb-6 md:space-y-0 space-y-3 md:flex justify-between items-center">
        <div className="flex items-center justify-center gap-1">
          <h1 className="md:text-3xl text-2xl font-bold">{t("buyOptions")}</h1>
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
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <CallOptionBuyForm />
            <BTCPriceChart mode="buyer" />
          </div>
          <OptionsViewer mode="buyer" />
        </div>
      )}
    </>
  );
}

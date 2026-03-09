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
import { CallWriteOptionForm } from "./call/CallWriteOptionForm";

export function WriteOptionsView() {
  const t = useTranslations("Pages");
  const [optionType, setOptionType] = useState<OptionType>("call");
  const { openModal } = useModal();

  const isPutDisabled = optionType === "put";

  return (
    <>
      <div className="text-center mb-6  flex justify-between items-center">
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

      {isPutDisabled && (
        <div className="text-center py-12">
          <p className="text-muted-foreground">{t("putsComingSoon")}</p>
        </div>
      )}

      {!isPutDisabled && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <CallWriteOptionForm />
            <BTCPriceChart mode="writer" />
          </div>
          <OptionsViewer mode="writer" />
        </div>
      )}
    </>
  );
}

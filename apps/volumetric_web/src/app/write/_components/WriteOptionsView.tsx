"use client";

import { HelpCircle } from "lucide-react";
import { useState } from "react";
import { OptionsViewer } from "@/components/options/OptionsViewer";
import { OptionTypeToggle } from "@/components/options/OptionTypeToggle";
import { Button } from "@/components/ui/button";
import { OnboardingContent } from "@/components/wallet/OnboardingModal";
import { useModal } from "@/hooks";
import type { OptionType } from "@/types/ui";
import { CallWriteOptionForm } from "./call/CallWriteOptionForm";

export function WriteOptionsView() {
  const [optionType, setOptionType] = useState<OptionType>("call");
  const { openModal } = useModal();

  const isPutDisabled = optionType === "put";

  return (
    <>
      <div className="text-center space-y-4 mb-8">
        <div className="flex items-center justify-center gap-2">
          <h1 className="text-3xl font-bold">Write options</h1>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => openModal(<OnboardingContent />)}
            className="size-8"
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
          <p className="text-muted-foreground">Puts coming soon</p>
        </div>
      )}

      {!isPutDisabled && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <CallWriteOptionForm />
          <OptionsViewer mode="writer" />
        </div>
      )}
    </>
  );
}

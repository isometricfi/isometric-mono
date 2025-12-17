"use client";

import { useState } from "react";
import { OptionsViewer } from "@/components/options/OptionsViewer";
import { OptionTypeToggle } from "@/components/options/OptionTypeToggle";
import type { OptionType } from "@/store/optionsStore";
import { CallOptionBuyForm } from "./call/CallOptionBuyForm";

export function BuyOptionsView() {
  const [optionType, setOptionType] = useState<OptionType>("call");

  const isPutDisabled = optionType === "put";

  return (
    <>
      <div className="text-center space-y-4 mb-8">
        <h1 className="text-3xl font-bold">Buy options</h1>
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
          <CallOptionBuyForm />
          <OptionsViewer mode="buyer" />
        </div>
      )}
    </>
  );
}

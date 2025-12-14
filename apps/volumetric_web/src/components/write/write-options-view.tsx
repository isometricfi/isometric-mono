"use client";

import { useState } from "react";
import {
  OptionTypeToggle,
  OptionForm,
  PriceChart,
  type OptionType,
  type OptionFormData,
} from "@/components/write";

export function WriteOptionsView() {
  const [optionType, setOptionType] = useState<OptionType>("call");

  const isPutDisabled = optionType === "put";

  return (
    <>
      {/* header */}
      <div className="text-center space-y-4 mb-8">
        <h1 className="text-3xl font-bold">Write options</h1>
        <div className="flex justify-center">
          <OptionTypeToggle value={optionType} onChange={setOptionType} />
        </div>
      </div>

      {/* coming soon overlay for puts */}
      {isPutDisabled && (
        <div className="text-center py-12">
          <p className="text-muted-foreground">Puts coming soon</p>
        </div>
      )}

      {/* main content */}
      {!isPutDisabled && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <OptionForm />
          <PriceChart />
        </div>
      )}
    </>
  );
}


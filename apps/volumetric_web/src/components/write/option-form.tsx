"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { TermSelector, type TermDays } from "./term-selector";
import { StrikeSelector } from "./strike-selector";
import { PremiumSelector } from "./premium-selector";
import { AmountInput } from "./amount-input";
import { OptionSummary } from "./option-summary";

// mock current price - will be replaced with real data
const MOCK_CURRENT_PRICE = 90235;

export function OptionForm() {
  const [term, setTerm] = useState<TermDays>(7);
  const [strike, setStrike] = useState(100000);
  const [premium, setPremium] = useState(1);
  const [amount, setAmount] = useState("");

  const handleSubmit = () => {};

  const parsedAmount = parseFloat(amount) || 0;

  return (
    <div className="bg-card rounded-3xl border border-border p-6 space-y-5">
      <TermSelector value={term} onChange={setTerm} />

      <StrikeSelector
        value={strike}
        onChange={setStrike}
        currentPrice={MOCK_CURRENT_PRICE}
        step={5000}
      />

      <PremiumSelector value={premium} onChange={setPremium} step={0.25} />

      <AmountInput value={amount} onChange={setAmount} />

      <Button
        onClick={handleSubmit}
        className="w-full rounded-full py-6 text-base font-semibold"
        size="lg"
      >
        Create Offer
      </Button>

      <OptionSummary amount={parsedAmount} premium={premium} term={term} />
    </div>
  );
}

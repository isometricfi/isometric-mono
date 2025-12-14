"use client";

import { ArrowLeft, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SlidingNumber } from "@/components/ui/sliding-number";

interface PremiumSelectorProps {
  value: number;
  onChange: (value: number) => void;
  step?: number;
  min?: number;
  max?: number;
}

export function PremiumSelector({
  value,
  onChange,
  step = 0.25,
  min = 0.25,
  max = 50,
}: PremiumSelectorProps) {
  const handleDecrement = () => {
    onChange(Math.max(min, value - step));
  };

  const handleIncrement = () => {
    onChange(Math.min(max, value + step));
  };

  // format to 2 decimal places for display
  const displayValue = Number(value.toFixed(2));

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-foreground">Premium</p>
      <div className="flex items-center gap-2">
        <Button
          variant="secondary"
          size="icon"
          onClick={handleDecrement}
          disabled={value <= min}
          className="rounded-full shrink-0"
        >
          <ArrowLeft className="size-4" />
        </Button>
        <div className="flex-1 flex items-center justify-center py-3 px-4 bg-secondary/50 rounded-full">
          <span className="text-sm font-medium flex items-center">
            <SlidingNumber value={displayValue} />
            <span>%</span>
          </span>
        </div>
        <Button
          variant="default"
          size="icon"
          onClick={handleIncrement}
          disabled={value >= max}
          className="rounded-full shrink-0"
        >
          <ArrowRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}

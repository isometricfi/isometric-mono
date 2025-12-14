"use client";

import { ArrowLeft, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SlidingNumber } from "@/components/ui/sliding-number";

interface StrikeSelectorProps {
  value: number;
  onChange: (value: number) => void;
  currentPrice: number;
  step?: number;
  label?: string;
}

export function StrikeSelector({
  value,
  onChange,
  currentPrice,
  step = 5000,
  label = "Strike",
}: StrikeSelectorProps) {
  // minimum strike is the next step above current price
  const minStrike = Math.ceil(currentPrice / step) * step;

  const handleDecrement = () => {
    onChange(Math.max(minStrike, value - step));
  };

  const handleIncrement = () => {
    onChange(value + step);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-foreground">{label}</p>
        <span className="text-sm text-muted-foreground">
          Current: ${currentPrice.toLocaleString()}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="secondary"
          size="icon"
          onClick={handleDecrement}
          disabled={value <= minStrike}
          className="rounded-full shrink-0"
        >
          <ArrowLeft className="size-4" />
        </Button>
        <div className="flex-1 flex items-center justify-center py-3 px-4 bg-secondary/50 rounded-full">
          <span className="text-sm font-medium flex items-center">
            $<SlidingNumber value={value} />
          </span>
        </div>
        <Button
          variant="default"
          size="icon"
          onClick={handleIncrement}
          className="rounded-full shrink-0"
        >
          <ArrowRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}

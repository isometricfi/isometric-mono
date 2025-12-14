"use client";

import { type ChangeEvent } from "react";

interface AmountInputProps {
  value: string;
  onChange: (value: string) => void;
  symbol?: string;
}

export function AmountInput({
  value,
  onChange,
  symbol = "₿",
}: AmountInputProps) {
  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    // allow empty string, numbers, and decimals
    if (newValue === "" || /^\d*\.?\d*$/.test(newValue)) {
      onChange(newValue);
    }
  };

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-foreground">Amount</p>
      <div className="relative">
        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground">
          {symbol}
        </span>
        <input
          type="text"
          inputMode="decimal"
          value={value}
          onChange={handleChange}
          placeholder="0.00"
          className="w-full py-3 pl-10 pr-4 bg-secondary/50 rounded-full text-sm font-medium placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>
    </div>
  );
}


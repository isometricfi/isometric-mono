"use client";

import { motion } from "framer-motion";

export type TermDays = 7 | 14 | 32;

interface TermOption {
  value: TermDays;
  label: string;
}

const termOptions: TermOption[] = [
  { value: 7, label: "7 Days" },
  { value: 14, label: "14 Days" },
  { value: 32, label: "32 Days" },
];

interface TermSelectorProps {
  value: TermDays;
  onChange: (value: TermDays) => void;
}

export function TermSelector({ value, onChange }: TermSelectorProps) {
  return (
    <div className="space-y-1">
      <p className="text-sm font-medium text-foreground">Term</p>
      <div className="flex rounded-full bg-muted p-1">
        {termOptions.map((option) => {
          const isActive = value === option.value;

          return (
            <button
              key={option.value}
              onClick={() => onChange(option.value)}
              className={`relative flex-1 px-4 py-2 text-sm font-medium rounded-full transition-colors ${
                isActive
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {isActive && (
                <motion.div
                  layoutId="termSelector"
                  className="absolute inset-0 bg-background rounded-full shadow-sm"
                  transition={{ type: "spring", duration: 0.5 }}
                />
              )}
              <span className="relative z-10">{option.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}


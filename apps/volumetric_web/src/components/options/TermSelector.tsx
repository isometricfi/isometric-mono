"use client";

import { motion } from "framer-motion";
import { useConfig } from "@/hooks";

interface TermSelectorProps {
  value: number;
  onChange: (value: number) => void;
}

export function TermSelector({ value, onChange }: TermSelectorProps) {
  const { data: config } = useConfig();
  const termOptions = config?.termOptions ?? [];

  return (
    <div className="space-y-1">
      <p className="text-sm font-medium text-foreground">Term</p>
      <div className="flex rounded-full bg-muted p-1">
        {termOptions.map((term) => {
          const isActive = value === term;

          return (
            <button
              type="button"
              key={term}
              onClick={() => onChange(term)}
              className={`relative flex-1 px-4 py-2 text-sm font-medium rounded-full transition-colors ${
                isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {isActive && (
                <motion.div
                  layoutId="termSelector"
                  className="absolute inset-0 bg-background rounded-full shadow-sm"
                  transition={{ type: "spring", duration: 0.5 }}
                />
              )}
              <span className="relative z-10">{term} Days</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

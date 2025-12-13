"use client";

import { motion } from "framer-motion";
import { type LucideIcon } from "lucide-react";

export interface ToggleOption<T extends string> {
  value: T;
  label: string;
  icon?: LucideIcon;
}

interface AnimatedToggleProps<T extends string> {
  options: ToggleOption<T>[];
  value: T;
  onChange: (value: T) => void;
  layoutId?: string;
}

export function AnimatedToggle<T extends string>({
  options,
  value,
  onChange,
  layoutId = "activeTab",
}: AnimatedToggleProps<T>) {
  return (
    <div className="inline-flex items-center p-1 rounded-full bg-muted">
      {options.map((option) => {
        const Icon = option.icon;
        const isActive = value === option.value;

        return (
          <button
            key={option.value}
            onClick={() => onChange(option.value)}
            className={`relative px-5 py-2 text-sm font-medium rounded-full transition-all ${
              isActive
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {isActive && (
              <motion.div
                layoutId={layoutId}
                className="absolute inset-0 bg-background rounded-full shadow-sm"
                transition={{ type: "spring", duration: 0.5 }}
              />
            )}
            <span className="relative z-10 flex items-center gap-2">
              {Icon && <Icon className="size-3.5" />}
              {option.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

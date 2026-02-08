"use client";

import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ToggleOption<T extends string | number> {
  value: T;
  label: string;
  icon?: LucideIcon;
}

interface AnimatedToggleProps<T extends string | number> {
  options: ToggleOption<T>[];
  value: T;
  onChange: (value: T) => void;
  layoutId?: string;
  size?: "default" | "sm";
  className?: string;
}

export function AnimatedToggle<T extends string | number>({
  options,
  value,
  onChange,
  layoutId = "activeTab",
  size = "default",
  className,
}: AnimatedToggleProps<T>) {
  return (
    <div className={cn("inline-flex items-center p-1 rounded-xl bg-muted", className)}>
      {options.map((option) => {
        const Icon = option.icon;
        const isActive = value === option.value;

        return (
          <button
            type="button"
            key={option.value}
            onClick={() => onChange(option.value)}
            className={cn(
              "relative font-medium rounded-lg transition-all w-full",
              size === "sm"
                ? "px-3 py-1 text-xs"
                : "md:px-5 h-full md:py-1 px-3 py-2 md:text-sm text-xs ",
              isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {isActive && (
              <motion.div
                layoutId={layoutId}
                className="absolute inset-0 bg-background shadow-sm rounded-lg"
                transition={{ type: "spring", duration: 0.5 }}
              />
            )}
            <span className="relative z-10 flex items-center gap-2 justify-center">
              {Icon && <Icon className={cn(size === "sm" ? "size-3" : "size-3.5")} />}
              {option.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

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

/**
 * Isometric animated toggle — warm-dark track with a coral-glowing thumb that
 * slides between options. The active pill picks up a subtle gradient + inner
 * highlight + soft coral glow so it visually "lifts" out of the track.
 *
 * Pairs naturally with the landing's pills, segmented controls, and the
 * "7 Days" timeframe selector in the traders card.
 */
export function AnimatedToggle<T extends string | number>({
  options,
  value,
  onChange,
  layoutId = "activeTab",
  size = "default",
  className,
}: AnimatedToggleProps<T>) {
  return (
    <div
      className={cn(
        // track — coral-tinted recess. Warm peach in light, deep coral-black in dark.
        "inline-flex items-center p-1 rounded-[10px]",
        "bg-[color-mix(in_oklch,var(--primary)_8%,var(--muted))]",
        "dark:bg-[color-mix(in_oklch,var(--primary)_10%,oklch(0_0_0/0.45))]",
        "border border-border/70",
        "shadow-[inset_0_1px_2px_color-mix(in_oklch,var(--primary)_15%,rgba(0,0,0,0.18))]",
        "dark:shadow-[inset_0_1px_2px_rgba(0,0,0,0.45)]",
        className,
      )}
    >
      {options.map((option) => {
        const Icon = option.icon;
        const isActive = value === option.value;

        return (
          <button
            type="button"
            key={option.value}
            onClick={() => onChange(option.value)}
            className={cn(
              // base
              "relative font-semibold tracking-tight rounded-[7px] w-full",
              "transition-colors duration-150 outline-none",
              "focus-visible:ring-2 focus-visible:ring-primary/50",
              // sizing
              size === "sm"
                ? "px-3 py-1 text-xs"
                : "md:px-5 h-full md:py-1.5 px-3 py-2 md:text-sm text-xs",
              // text color
              isActive ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {isActive && (
              <motion.div
                layoutId={layoutId}
                className={cn(
                  "absolute inset-0 rounded-[7px]",
                  // coral surface with subtle top-light gradient
                  "bg-[linear-gradient(180deg,color-mix(in_oklch,var(--primary)_100%,white_8%),var(--primary))]",
                  "border border-white/10",
                  // inner highlight + coral glow
                  "shadow-[inset_0_1px_0_rgba(255,255,255,0.28),0_6px_18px_-8px_color-mix(in_oklch,var(--primary)_70%,transparent),0_2px_4px_-1px_rgba(0,0,0,0.35)]",
                )}
                transition={{ type: "spring", stiffness: 380, damping: 32 }}
              />
            )}
            <span
              className={cn(
                size === "sm" ? "gap-1" : "gap-2",
                "relative z-10 flex items-center justify-center whitespace-nowrap",
              )}
            >
              {Icon && <Icon className={cn(size === "sm" ? "size-3" : "size-3.5")} />}
              {option.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

"use client";

import * as ProgressPrimitive from "@radix-ui/react-progress";
import type * as React from "react";

import { cn } from "@/lib/utils";

function Progress({
  className,
  value,
  indeterminate,
  ...props
}: React.ComponentProps<typeof ProgressPrimitive.Root> & {
  indeterminate?: boolean;
}) {
  const isIndeterminate = indeterminate || value == null;

  return (
    <ProgressPrimitive.Root
      data-slot="progress"
      className={cn(
        "relative h-2 w-full overflow-hidden rounded-full",
        // coral-tinted warm recess — matches Slider track
        "bg-[color-mix(in_oklch,var(--primary)_8%,var(--muted))]",
        "dark:bg-[color-mix(in_oklch,var(--primary)_10%,oklch(0_0_0/0.4))]",
        "shadow-[inset_0_1px_2px_rgba(0,0,0,0.12)]",
        "dark:shadow-[inset_0_1px_2px_rgba(0,0,0,0.45)]",
        className,
      )}
      {...props}
    >
      <ProgressPrimitive.Indicator
        data-slot="progress-indicator"
        className={cn(
          "relative h-full w-full flex-1 overflow-hidden",
          // coral fill with subtle gradient + glow
          "bg-[linear-gradient(90deg,color-mix(in_oklch,var(--primary)_100%,white_4%),var(--primary))]",
          "shadow-[0_0_10px_-2px_color-mix(in_oklch,var(--primary)_60%,transparent)]",
          "transition-transform duration-500 ease-out",
          // sheen shimmer overlay
          "after:absolute after:inset-0 after:-translate-x-full",
          "after:bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.25),transparent)]",
          "after:animate-shimmer",
          isIndeterminate && "animate-pulse",
        )}
        style={
          isIndeterminate
            ? { transform: "translateX(-30%)", width: "40%" }
            : { transform: `translateX(-${100 - (value || 0)}%)` }
        }
      />
    </ProgressPrimitive.Root>
  );
}

export { Progress };

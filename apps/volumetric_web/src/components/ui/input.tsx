import type * as React from "react";

import { cn } from "@/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        // base layout
        "h-10 w-full min-w-0 rounded-[8px] px-3.5 py-2 text-base md:text-sm",
        "outline-none transition-[color,box-shadow,border-color,background-color] duration-150",
        // surface — warm recess, coral-tinted in both modes
        "bg-[color-mix(in_oklch,var(--primary)_4%,var(--background))]",
        "dark:bg-[color-mix(in_oklch,var(--primary)_6%,oklch(0_0_0/0.35))]",
        // hairline border + subtle inner shadow so it feels "carved in"
        "border border-border",
        "shadow-[inset_0_1px_2px_color-mix(in_oklch,var(--primary)_10%,rgba(0,0,0,0.06))]",
        "dark:shadow-[inset_0_1px_2px_rgba(0,0,0,0.4)]",
        // text + placeholder
        "text-foreground placeholder:text-muted-foreground/70",
        "selection:bg-primary selection:text-primary-foreground",
        // file inputs
        "file:text-foreground file:inline-flex file:h-7 file:border-0",
        "file:bg-transparent file:text-sm file:font-medium",
        // hover
        "hover:border-primary/30",
        // focus — coral border + soft coral glow halo
        "focus-visible:border-primary",
        "focus-visible:ring-2 focus-visible:ring-primary/30",
        "focus-visible:bg-[color-mix(in_oklch,var(--primary)_6%,var(--background))]",
        "dark:focus-visible:bg-[color-mix(in_oklch,var(--primary)_8%,oklch(0_0_0/0.35))]",
        // disabled
        "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
        // invalid
        "aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/30",
        // numeric inputs feel right in mono
        "[&[type=number]]:font-mono [&[type=number]]:tabular-nums",
        className,
      )}
      {...props}
    />
  );
}

export { Input };

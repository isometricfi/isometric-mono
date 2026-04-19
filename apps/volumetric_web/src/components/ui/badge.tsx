import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  cn(
    "inline-flex items-center justify-center w-fit shrink-0 whitespace-nowrap overflow-hidden",
    "rounded-full px-2.5 py-0.5 text-[11px] font-semibold tracking-wide uppercase",
    "border gap-1.5",
    "[&>svg]:size-3 [&>svg]:pointer-events-none",
    "transition-all duration-150",
    "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background",
    "aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/30",
  ),
  {
    variants: {
      variant: {
        // Solid coral
        default: cn(
          "border-white/10 text-primary-foreground",
          "bg-[linear-gradient(180deg,color-mix(in_oklch,var(--primary)_100%,white_8%),var(--primary))]",
          "shadow-[inset_0_1px_0_rgba(255,255,255,0.25),0_2px_6px_-2px_color-mix(in_oklch,var(--primary)_50%,transparent)]",
          "[a&]:hover:brightness-[1.06]",
        ),
        // Neutral warm
        secondary: cn(
          "border-border bg-secondary text-secondary-foreground",
          "shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]",
          "[a&]:hover:bg-[color-mix(in_oklch,var(--secondary)_85%,white_5%)]",
        ),
        // Red
        destructive: cn(
          "border-white/10 text-white",
          "bg-[linear-gradient(180deg,color-mix(in_oklch,var(--destructive)_100%,white_8%),var(--destructive))]",
          "shadow-[inset_0_1px_0_rgba(255,255,255,0.20),0_2px_6px_-2px_color-mix(in_oklch,var(--destructive)_50%,transparent)]",
          "focus-visible:ring-destructive/40",
        ),
        // Hairline only
        outline: cn(
          "border-border text-foreground bg-transparent",
          "[a&]:hover:bg-accent [a&]:hover:text-accent-foreground [a&]:hover:border-primary/30",
        ),
        // Translucent coral wash — the "Public Beta" / hero pill recipe
        soft: cn(
          "border-[color-mix(in_oklch,var(--primary)_30%,transparent)]",
          "bg-[color-mix(in_oklch,var(--primary)_12%,transparent)]",
          "text-primary",
          "[a&]:hover:bg-[color-mix(in_oklch,var(--primary)_18%,transparent)]",
        ),
        // Success green wash — for +earned / +ROI
        success: cn(
          "border-[color-mix(in_oklch,var(--success)_30%,transparent)]",
          "bg-[color-mix(in_oklch,var(--success)_12%,transparent)]",
          "text-success",
        ),
        // Warning amber wash
        warning: cn(
          "border-[color-mix(in_oklch,var(--chart-3)_30%,transparent)]",
          "bg-[color-mix(in_oklch,var(--chart-3)_12%,transparent)]",
          "text-[color-mix(in_oklch,var(--chart-3)_85%,var(--foreground))]",
        ),
        // Live — coral text + animated dot prefix (provided via ::before)
        live: cn(
          "border-[color-mix(in_oklch,var(--primary)_30%,transparent)]",
          "bg-[color-mix(in_oklch,var(--primary)_10%,transparent)]",
          "text-primary",
          "before:content-[''] before:size-1.5 before:rounded-full before:bg-primary",
          "before:shadow-[0_0_8px_var(--primary)]",
          "before:animate-pulse",
        ),
      },
      size: {
        default: "px-2.5 py-0.5 text-[11px] [&>svg]:size-3",
        sm: "px-2 py-0 text-[10px] [&>svg]:size-2.5",
        lg: "px-3 py-1 text-xs [&>svg]:size-3.5 gap-2",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Badge({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "span";

  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      className={cn(badgeVariants({ variant, size }), className)}
      {...props}
    />
  );
}

export { Badge, badgeVariants };

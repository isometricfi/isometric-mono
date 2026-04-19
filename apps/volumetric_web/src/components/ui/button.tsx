import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  [
    "relative inline-flex items-center justify-center gap-2 whitespace-nowrap",
    "rounded-[10px] text-sm font-semibold tracking-tight",
    "transition-all duration-150 ease-out will-change-transform",
    "disabled:pointer-events-none disabled:opacity-50",
    "[&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0",
    "outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
    "aria-invalid:ring-destructive/30 aria-invalid:border-destructive",
    "active:translate-y-px",
  ].join(" "),
  {
    variants: {
      variant: {
        // Primary — coral with top-light gradient, inset highlight, coral glow
        default: [
          "text-primary-foreground",
          "bg-[linear-gradient(180deg,color-mix(in_oklch,var(--primary)_100%,white_8%),var(--primary))]",
          "border border-white/10",
          "shadow-[inset_0_1px_0_rgba(255,255,255,0.28),0_8px_24px_-10px_color-mix(in_oklch,var(--primary)_70%,transparent),0_2px_6px_-2px_rgba(0,0,0,0.4)]",
          "hover:brightness-[1.06] hover:-translate-y-px",
          "hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.32),0_12px_28px_-8px_color-mix(in_oklch,var(--primary)_75%,transparent),0_3px_8px_-2px_rgba(0,0,0,0.45)]",
          "active:brightness-95",
        ].join(" "),

        // Destructive — same lifted treatment, red glow
        destructive: [
          "text-white",
          "bg-[linear-gradient(180deg,color-mix(in_oklch,var(--destructive)_100%,white_8%),var(--destructive))]",
          "border border-white/10",
          "shadow-[inset_0_1px_0_rgba(255,255,255,0.25),0_8px_24px_-10px_color-mix(in_oklch,var(--destructive)_70%,transparent),0_2px_6px_-2px_rgba(0,0,0,0.4)]",
          "hover:brightness-[1.06] hover:-translate-y-px",
          "focus-visible:ring-destructive/40",
        ].join(" "),

        // Outline — subtle warm card with hairline border, no glow
        outline: [
          "text-foreground bg-card/60 backdrop-blur-sm",
          "border border-border",
          "shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_1px_2px_rgba(0,0,0,0.25)]",
          "hover:bg-card hover:border-primary/30 hover:text-foreground",
          "hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_4px_12px_-4px_rgba(0,0,0,0.4)]",
        ].join(" "),

        // Secondary — flat warm surface, gentle lift
        secondary: [
          "bg-secondary text-secondary-foreground",
          "border border-white/[0.04]",
          "shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_2px_4px_rgba(0,0,0,0.25)]",
          "hover:bg-[color-mix(in_oklch,var(--secondary)_85%,white_5%)]",
          "hover:-translate-y-px hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.07),0_4px_10px_-2px_rgba(0,0,0,0.35)]",
        ].join(" "),

        // Ghost — invisible until hover, no shadow
        ghost: ["text-muted-foreground", "hover:bg-accent hover:text-accent-foreground"].join(" "),

        // Link — text-only coral
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-[18px] py-2 has-[>svg]:px-4",
        sm: "h-8 rounded-[8px] gap-1.5 px-3 text-xs has-[>svg]:px-2.5",
        lg: "h-11 rounded-[12px] px-7 text-[15px] has-[>svg]:px-5",
        xl: "h-12 rounded-[12px] px-8 text-base has-[>svg]:px-6",
        icon: "size-10",
        "icon-sm": "size-8 rounded-[8px]",
        "icon-lg": "size-11 rounded-[12px]",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot : "button";

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };

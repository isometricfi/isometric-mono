import type * as React from "react";

import { cn } from "@/lib/utils";

function Card({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card"
      className={cn(
        // base
        "relative flex flex-col gap-6 rounded-xl md:py-6 py-4",
        "text-card-foreground",
        // surface — gradient from card -> slightly darker so it has depth
        "bg-[linear-gradient(180deg,color-mix(in_oklch,var(--card)_100%,white_2%),var(--card))]",
        // hairline border with coral tint
        "border border-border",
        // light mode: soft warm shadow
        "shadow-[0_1px_2px_rgba(24,16,12,0.04),0_4px_12px_-4px_rgba(24,16,12,0.06)]",
        // dark mode: deeper warm shadow + inner top highlight
        "dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_8px_24px_-12px_rgba(0,0,0,0.55)]",
        // subtle transition for interactive variants
        "transition-all duration-200 ease-out",
        // raised variant
        "data-[variant=raised]:shadow-[0_2px_4px_rgba(24,16,12,0.05),0_12px_28px_-10px_rgba(24,16,12,0.10)]",
        "dark:data-[variant=raised]:shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_20px_50px_-20px_rgba(0,0,0,0.7),0_4px_12px_-4px_rgba(0,0,0,0.4)]",
        // muted — flatter, no shadow, sits inside another card
        "data-[variant=muted]:bg-[color-mix(in_oklch,var(--primary)_4%,var(--muted))] data-[variant=muted]:shadow-none data-[variant=muted]:border-border/60",
        "dark:data-[variant=muted]:bg-[oklch(0_0_0/0.18)]",
        // glass — translucent, blurred (nav / overlays)
        "data-[variant=glass]:bg-card/70 data-[variant=glass]:backdrop-blur-md",
        "data-[variant=glass]:shadow-[0_2px_8px_rgba(24,16,12,0.06)]",
        "dark:data-[variant=glass]:shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_12px_32px_-16px_rgba(0,0,0,0.6)]",
        // interactive
        "data-[interactive]:cursor-pointer data-[interactive]:hover:-translate-y-0.5 data-[interactive]:hover:border-primary/30",
        "data-[interactive]:hover:shadow-[0_2px_4px_rgba(24,16,12,0.05),0_8px_20px_-6px_rgba(24,16,12,0.10),0_0_0_1px_color-mix(in_oklch,var(--primary)_20%,transparent)]",
        "dark:data-[interactive]:hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_16px_36px_-12px_rgba(0,0,0,0.6),0_0_0_1px_color-mix(in_oklch,var(--primary)_25%,transparent)]",
        className,
      )}
      {...props}
    />
  );
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-header"
      className={cn(
        "@container/card-header grid auto-rows-min grid-rows-[auto_auto] items-start gap-2",
        "md:px-6 px-4",
        "has-data-[slot=card-action]:grid-cols-[1fr_auto]",
        "[.border-b]:pb-5 [.border-b]:border-border",
        className,
      )}
      {...props}
    />
  );
}

function CardTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-title"
      className={cn(
        // matches the landing's h3 vibe — tight, bold, slightly larger
        "text-lg md:text-xl font-bold leading-tight tracking-tight text-foreground",
        className,
      )}
      {...props}
    />
  );
}

function CardDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-description"
      className={cn("text-muted-foreground text-sm leading-relaxed", className)}
      {...props}
    />
  );
}

/**
 * CardEyebrow — uppercase mono label like "FOR TRADERS" / "STEP 01".
 * Pair above CardTitle for the landing's section-header rhythm.
 */
function CardEyebrow({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-eyebrow"
      className={cn(
        "font-mono text-[11px] tracking-[0.16em] uppercase text-muted-foreground",
        "inline-flex items-center gap-2",
        "[&_svg]:size-3.5 [&_svg]:text-primary",
        className,
      )}
      {...props}
    />
  );
}

function CardAction({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-action"
      className={cn("col-start-2 row-span-2 row-start-1 self-start justify-self-end", className)}
      {...props}
    />
  );
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="card-content" className={cn("md:px-6 px-4", className)} {...props} />;
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-footer"
      className={cn(
        "flex items-center md:px-6 px-4",
        "[.border-t]:pt-5 [.border-t]:border-border",
        className,
      )}
      {...props}
    />
  );
}

export {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardEyebrow,
  CardFooter,
  CardHeader,
  CardTitle,
};

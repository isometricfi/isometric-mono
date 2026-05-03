"use client";

import type * as React from "react";
import { Drawer as DrawerPrimitive } from "vaul";

import { cn } from "@/lib/utils";

function Drawer({
  repositionInputs = false,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Root>) {
  return <DrawerPrimitive.Root data-slot="drawer" repositionInputs={repositionInputs} {...props} />;
}

function DrawerTrigger({ ...props }: React.ComponentProps<typeof DrawerPrimitive.Trigger>) {
  return <DrawerPrimitive.Trigger data-slot="drawer-trigger" {...props} />;
}

function DrawerPortal({ ...props }: React.ComponentProps<typeof DrawerPrimitive.Portal>) {
  return <DrawerPrimitive.Portal data-slot="drawer-portal" {...props} />;
}

function DrawerClose({ ...props }: React.ComponentProps<typeof DrawerPrimitive.Close>) {
  return <DrawerPrimitive.Close data-slot="drawer-close" {...props} />;
}

function DrawerOverlay({
  className,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Overlay>) {
  return (
    <DrawerPrimitive.Overlay
      data-slot="drawer-overlay"
      className={cn(
        "fixed inset-0 z-50",
        "bg-[rgba(14,9,7,0.65)] backdrop-blur-sm",
        "data-[state=open]:animate-in data-[state=closed]:animate-out",
        "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
        className,
      )}
      {...props}
    />
  );
}

function DrawerContent({
  className,
  children,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Content>) {
  return (
    <DrawerPortal data-slot="drawer-portal">
      <DrawerOverlay />
      <DrawerPrimitive.Content
        data-slot="drawer-content"
        className={cn(
          "group/drawer-content fixed z-50 flex h-auto flex-col text-foreground",
          // shared surface — warm gradient + hairline + light/dark shadows
          "bg-[linear-gradient(180deg,color-mix(in_oklch,var(--card)_100%,white_3%),var(--card))]",
          "shadow-[0_-8px_24px_-8px_rgba(24,16,12,0.10),0_-20px_50px_-16px_rgba(24,16,12,0.18)]",
          "dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_-24px_60px_-16px_rgba(0,0,0,0.7),0_-8px_20px_-8px_rgba(0,0,0,0.5)]",
          // direction-specific anchoring, radii, and border sides
          "data-[vaul-drawer-direction=top]:inset-x-0 data-[vaul-drawer-direction=top]:top-0 data-[vaul-drawer-direction=top]:mb-24 data-[vaul-drawer-direction=top]:max-h-[80vh] data-[vaul-drawer-direction=top]:rounded-b-[18px] data-[vaul-drawer-direction=top]:border-b data-[vaul-drawer-direction=top]:border-border",
          "data-[vaul-drawer-direction=bottom]:inset-x-0 data-[vaul-drawer-direction=bottom]:bottom-0 data-[vaul-drawer-direction=bottom]:mt-24 data-[vaul-drawer-direction=bottom]:max-h-[80vh] data-[vaul-drawer-direction=bottom]:rounded-t-[18px] data-[vaul-drawer-direction=bottom]:border-t data-[vaul-drawer-direction=bottom]:border-border",
          "data-[vaul-drawer-direction=right]:inset-y-0 data-[vaul-drawer-direction=right]:right-0 data-[vaul-drawer-direction=right]:w-3/4 data-[vaul-drawer-direction=right]:border-l data-[vaul-drawer-direction=right]:border-border data-[vaul-drawer-direction=right]:sm:max-w-sm",
          "data-[vaul-drawer-direction=left]:inset-y-0 data-[vaul-drawer-direction=left]:left-0 data-[vaul-drawer-direction=left]:w-3/4 data-[vaul-drawer-direction=left]:border-r data-[vaul-drawer-direction=left]:border-border data-[vaul-drawer-direction=left]:sm:max-w-sm",
          className,
        )}
        {...props}
      >
        {/* Drag handle — coral-tinted, with a soft glow to feel alive.
            Shown on bottom drawers; also works as a tap target. */}
        <div
          className={cn(
            "mx-auto mt-3 hidden h-1.5 w-12 shrink-0 rounded-full",
            "bg-[color-mix(in_oklch,var(--primary)_35%,transparent)]",
            "shadow-[0_0_12px_color-mix(in_oklch,var(--primary)_45%,transparent)]",
            "group-data-[vaul-drawer-direction=bottom]/drawer-content:block",
          )}
        />
        {/* Top drawers get a handle too, but at the bottom edge */}
        <div
          className={cn(
            "mx-auto mb-3 order-last hidden h-1.5 w-12 shrink-0 rounded-full",
            "bg-[color-mix(in_oklch,var(--primary)_35%,transparent)]",
            "shadow-[0_0_12px_color-mix(in_oklch,var(--primary)_45%,transparent)]",
            "group-data-[vaul-drawer-direction=top]/drawer-content:block",
          )}
        />
        {children}
      </DrawerPrimitive.Content>
    </DrawerPortal>
  );
}

function DrawerHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="drawer-header"
      className={cn(
        "flex flex-col gap-1.5 p-5",
        "group-data-[vaul-drawer-direction=bottom]/drawer-content:text-center",
        "group-data-[vaul-drawer-direction=top]/drawer-content:text-center",
        "md:gap-2 md:text-left",
        className,
      )}
      {...props}
    />
  );
}

function DrawerFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="drawer-footer"
      className={cn("mt-auto flex flex-col gap-2 p-5 pt-2", className)}
      {...props}
    />
  );
}

function DrawerTitle({ className, ...props }: React.ComponentProps<typeof DrawerPrimitive.Title>) {
  return (
    <DrawerPrimitive.Title
      data-slot="drawer-title"
      className={cn("text-xl font-bold tracking-tight leading-tight text-foreground", className)}
      {...props}
    />
  );
}

function DrawerDescription({
  className,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Description>) {
  return (
    <DrawerPrimitive.Description
      data-slot="drawer-description"
      className={cn("text-muted-foreground text-sm leading-relaxed", className)}
      {...props}
    />
  );
}

export {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerOverlay,
  DrawerPortal,
  DrawerTitle,
  DrawerTrigger,
};

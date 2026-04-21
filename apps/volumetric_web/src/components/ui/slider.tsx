"use client";

import { Slider as SliderPrimitive } from "radix-ui";
import * as React from "react";

import { cn } from "@/lib/utils";

function Slider({
  className,
  defaultValue,
  value,
  min = 0,
  max = 100,
  ...props
}: React.ComponentProps<typeof SliderPrimitive.Root>) {
  const _values = React.useMemo(
    () => (Array.isArray(value) ? value : Array.isArray(defaultValue) ? defaultValue : [min]),
    [value, defaultValue, min],
  );
  const thumbKeys = React.useMemo(
    () => Array.from({ length: _values.length }, (_, thumbIndex) => `slider-thumb-${thumbIndex}`),
    [_values.length],
  );

  return (
    <SliderPrimitive.Root
      data-slot="slider"
      defaultValue={defaultValue}
      value={value}
      min={min}
      max={max}
      className={cn(
        "relative flex w-full touch-none items-center select-none",
        "data-disabled:opacity-50",
        "data-[orientation=vertical]:h-full data-[orientation=vertical]:min-h-44",
        "data-[orientation=vertical]:w-auto data-[orientation=vertical]:flex-col",
        className,
      )}
      {...props}
    >
      <SliderPrimitive.Track
        data-slot="slider-track"
        className={cn(
          "relative grow overflow-hidden rounded-full",
          // coral-tinted warm recess (matches Input track)
          "bg-[color-mix(in_oklch,var(--primary)_8%,var(--muted))]",
          "dark:bg-[color-mix(in_oklch,var(--primary)_10%,oklch(0_0_0/0.4))]",
          "shadow-[inset_0_1px_2px_rgba(0,0,0,0.12)]",
          "dark:shadow-[inset_0_1px_2px_rgba(0,0,0,0.45)]",
          "data-[orientation=horizontal]:h-2 data-[orientation=horizontal]:w-full",
          "data-[orientation=vertical]:h-full data-[orientation=vertical]:w-2",
        )}
      >
        <SliderPrimitive.Range
          data-slot="slider-range"
          className={cn(
            // coral fill with subtle gradient + soft glow
            "absolute",
            "bg-[linear-gradient(90deg,color-mix(in_oklch,var(--primary)_100%,white_4%),var(--primary))]",
            "shadow-[0_0_10px_-2px_color-mix(in_oklch,var(--primary)_60%,transparent)]",
            "data-[orientation=horizontal]:h-full data-[orientation=vertical]:w-full",
          )}
        />
      </SliderPrimitive.Track>
      {_values.map((_, thumbIndex) => (
        <SliderPrimitive.Thumb
          data-slot="slider-thumb"
          key={thumbKeys[thumbIndex]}
          className={cn(
            "block size-5 shrink-0 rounded-full",
            // surface — bright with subtle gradient so it has dimension
            "bg-[linear-gradient(180deg,#ffffff,#f4ece4)]",
            "dark:bg-[linear-gradient(180deg,#fff7ee,#f0e2d3)]",
            // coral border + lifted shadow + inner highlight
            "border-2 border-primary",
            "shadow-[inset_0_1px_0_rgba(255,255,255,0.6),0_2px_6px_-1px_color-mix(in_oklch,var(--primary)_55%,transparent),0_2px_4px_-1px_rgba(0,0,0,0.25)]",
            // motion + interaction
            "transition-[box-shadow,transform] duration-150",
            "hover:scale-110",
            "hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.7),0_4px_12px_-2px_color-mix(in_oklch,var(--primary)_70%,transparent),0_2px_6px_-1px_rgba(0,0,0,0.3)]",
            "focus-visible:outline-none",
            "focus-visible:shadow-[inset_0_1px_0_rgba(255,255,255,0.7),0_0_0_5px_color-mix(in_oklch,var(--primary)_25%,transparent),0_2px_6px_-1px_rgba(0,0,0,0.3)]",
            "active:scale-95",
            "disabled:pointer-events-none disabled:opacity-50",
            "cursor-grab active:cursor-grabbing",
          )}
        />
      ))}
    </SliderPrimitive.Root>
  );
}

export { Slider };

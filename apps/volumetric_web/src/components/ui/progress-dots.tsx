"use client";

import { cn } from "@/lib/utils";

interface ProgressDotsProps {
  keys: readonly string[];
  current: number;
  onDotClick?: (index: number) => void;
  isClickable?: (index: number) => boolean;
}

export function ProgressDots({ keys, current, onDotClick, isClickable }: ProgressDotsProps) {
  return (
    <div className="flex items-center justify-center gap-2">
      {keys.map((key, i) => {
        const active = i === current;
        const clickable = onDotClick !== undefined && (isClickable ? isClickable(i) : true);
        return (
          <button
            key={key}
            type="button"
            onClick={() => clickable && onDotClick?.(i)}
            disabled={!clickable}
            aria-current={active ? "step" : undefined}
            className={cn(
              "transition-all duration-500 rounded-sm h-1.5 p-0",
              active ? "w-8 bg-foreground" : "w-1.5 bg-muted-foreground/30",
              clickable && !active && "hover:bg-muted-foreground/50 cursor-pointer",
              !clickable && "cursor-default",
            )}
          />
        );
      })}
    </div>
  );
}

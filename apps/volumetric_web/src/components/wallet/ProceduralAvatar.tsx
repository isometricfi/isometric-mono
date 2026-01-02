"use client";

import { type CSSProperties, useMemo } from "react";
import { cn } from "@/lib/utils";

function hash32(input: string): number {
  if (!input) return 2166136261;
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function ProceduralAvatar({ seed, className }: { seed?: string; className?: string }) {
  const style = useMemo((): CSSProperties => {
    const h = hash32(seed || "");
    const h1 = h % 360;
    const h2 = (h * 7) % 360;
    const h3 = (h * 13) % 360;
    const h4 = (h * 29) % 360;

    return {
      backgroundImage: [
        `radial-gradient(circle at 30% 30%, hsl(${h1} 80% 60% / 0.9), transparent 55%)`,
        `radial-gradient(circle at 70% 65%, hsl(${h2} 85% 55% / 0.9), transparent 60%)`,
        `radial-gradient(circle at 35% 80%, hsl(${h3} 85% 55% / 0.6), transparent 55%)`,
        `linear-gradient(135deg, hsl(${h4} 80% 35% / 0.9), hsl(${h2} 80% 35% / 0.9))`,
      ].join(", "),
    };
  }, [seed]);

  return <div className={cn("rounded-2xl", className)} style={style} />;
}

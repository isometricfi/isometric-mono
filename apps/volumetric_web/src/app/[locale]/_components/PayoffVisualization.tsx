"use client";

import { animate } from "framer-motion";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export function PayoffVisualization() {
  const t = useTranslations("Landing");

  // Option Config
  const strikePrice = 90000;
  const sizeBTC = 0.3;
  const premiumBTC = 0.01;
  const primaryColor = "#e86c3a";

  const breakevenPrice = strikePrice + (premiumBTC / sizeBTC) * strikePrice;

  // Simulated BTC price walk — deterministic seed so it looks the same every load
  const pricePath = useMemo(() => {
    const steps = 120;
    const startPrice = 84000;
    const endPrice = 115000;
    const volatility = 1400;

    // mulberry32 PRNG for stable seeded noise
    let seed = 0x9e3779b9;
    const rand = () => {
      seed = (seed + 0x6d2b79f5) | 0;
      let x = seed;
      x = Math.imul(x ^ (x >>> 15), x | 1);
      x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
      return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
    };
    // Approximate gaussian via sum of uniforms
    const gauss = () => (rand() + rand() + rand() - 1.5) / 1.5;

    const prices: number[] = [startPrice];
    for (let i = 1; i < steps; i++) {
      const remaining = steps - i;
      const drift = (endPrice - prices[i - 1]) / remaining;
      const noise = gauss() * volatility;
      prices.push(prices[i - 1] + drift + noise);
    }
    return prices;
  }, []);

  const { priceMin, priceMax } = useMemo(() => {
    const lo = Math.min(...pricePath, breakevenPrice);
    const hi = Math.max(...pricePath, breakevenPrice);
    const pad = (hi - lo) * 0.08;
    return { priceMin: lo - pad, priceMax: hi + pad };
  }, [pricePath, breakevenPrice]);

  // Animation State
  const [progress, setProgress] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

  const currentIndex = Math.min(
    pricePath.length - 1,
    Math.floor(progress * (pricePath.length - 1)),
  );
  const spotPrice = pricePath[currentIndex];

  const calculatePnL = (S: number): number => {
    if (S <= strikePrice) return -premiumBTC;
    const intrinsicBTC = ((S - strikePrice) / S) * sizeBTC;
    return intrinsicBTC - premiumBTC;
  };

  const currentPnLBTC = calculatePnL(spotPrice);
  const roi = (currentPnLBTC / premiumBTC) * 100;

  // Scales (viewBox 0..100)
  const xScale = (i: number) => (i / (pricePath.length - 1)) * 100;
  const yScale = (price: number) => (1 - (price - priceMin) / (priceMax - priceMin)) * 100;

  const yBreakeven = yScale(breakevenPrice);

  const fullPathPoints = useMemo(
    () => pricePath.map((p, i) => `${xScale(i)},${yScale(p)}`).join(" "),
    // xScale/yScale are pure functions of pricePath length and priceMin/priceMax
    [pricePath, priceMin, priceMax],
  );

  const visiblePathPoints = pricePath
    .slice(0, currentIndex + 1)
    .map((p, i) => `${xScale(i)},${yScale(p)}`)
    .join(" ");

  const currentX = xScale(currentIndex);
  const currentY = yScale(spotPrice);

  // Profit area: close the traced line down to the breakeven level,
  // then clip to the region above breakeven so only in-profit area fills.
  const profitAreaPoints = `0,${yBreakeven} ${visiblePathPoints} ${currentX},${yBreakeven}`;

  // Measure container size (for the aspect-preserving dot overlay)
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setContainerSize({ width: rect.width, height: rect.height });
      }
    };
    updateSize();

    let timeoutId: ReturnType<typeof setTimeout>;
    const handleResize = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(updateSize, 150);
    };

    window.addEventListener("resize", handleResize);
    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  // Animation Loop
  useEffect(() => {
    const controls = animate(0, 1, {
      duration: 7,
      repeat: Infinity,
      ease: "linear",
      onUpdate: (value) => setProgress(value),
    });
    return () => controls.stop();
  }, []);

  return (
    <div className="relative">
      <div className="relative">
        <div className="relative">
          <div className="flex items-center justify-end mb-4">
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
              7 {t("dayTimeframe")}
            </span>
          </div>

          <div ref={containerRef} className="h-[120px] relative mb-4 w-full">
            <svg
              className="w-full h-full overflow-visible"
              preserveAspectRatio="none"
              viewBox="0 0 100 100"
            >
              <title>Payoff Visualization Chart</title>
              <defs>
                <linearGradient id="profitGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={primaryColor} stopOpacity="0.28" />
                  <stop offset="100%" stopColor={primaryColor} stopOpacity="0" />
                </linearGradient>
                <clipPath id="aboveBreakeven" clipPathUnits="userSpaceOnUse">
                  <rect x="0" y="0" width="100" height={yBreakeven} />
                </clipPath>
              </defs>

              {/* Breakeven dashed line */}
              <line
                x1={0}
                y1={yBreakeven}
                x2={100}
                y2={yBreakeven}
                className="stroke-foreground/25"
                strokeWidth="1"
                strokeDasharray="4 4"
                vectorEffect="non-scaling-stroke"
              />

              {/* Profit area — only shows where traced line is above breakeven */}
              <polygon
                points={profitAreaPoints}
                fill="url(#profitGradient)"
                clipPath="url(#aboveBreakeven)"
              />

              {/* Full path (muted preview of what's ahead) */}
              <polyline
                points={fullPathPoints}
                fill="none"
                stroke={primaryColor}
                strokeOpacity="0.15"
                strokeWidth="1.5"
                vectorEffect="non-scaling-stroke"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/* Traced portion (animated) */}
              <polyline
                points={visiblePathPoints}
                fill="none"
                stroke={primaryColor}
                strokeWidth="2.5"
                vectorEffect="non-scaling-stroke"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>

            {/* Overlay SVG for Dot (Preserves Aspect Ratio) */}
            {containerSize.width > 0 && (
              <svg
                className="absolute inset-0 w-full h-full pointer-events-none overflow-visible"
                width={containerSize.width}
                height={containerSize.height}
                viewBox={`0 0 ${containerSize.width} ${containerSize.height}`}
              >
                <title>Payoff Visualization Animated Indicator</title>
                <defs>
                  <radialGradient id="glowGradientOverlay">
                    <stop offset="0%" stopColor="#d4a574" stopOpacity="0.35" />
                    <stop offset="100%" stopColor="#d4a574" stopOpacity="0" />
                  </radialGradient>
                </defs>

                {/* Glowing Dot */}
                <circle
                  cx={(currentX / 100) * containerSize.width}
                  cy={(currentY / 100) * containerSize.height}
                  r="22"
                  fill="url(#glowGradientOverlay)"
                />

                {/* Solid Dot */}
                <circle
                  cx={(currentX / 100) * containerSize.width}
                  cy={(currentY / 100) * containerSize.height}
                  r="6"
                  fill="#d4a574"
                />
              </svg>
            )}
          </div>

          <div className="grid grid-cols-3 gap-2 -mt-3">
            <div className="text-center">
              <div className="text-[9px] font-mono text-muted-foreground">{t("price")}</div>
              <div className="text-sm font-mono font-semibold tabular-nums">
                ${(spotPrice / 1000).toFixed(0)}K
              </div>
            </div>
            <div className="text-center">
              <div className="text-[9px] font-mono text-muted-foreground">{t("profit")}</div>
              <div
                className={cn(
                  "text-sm font-mono font-semibold tabular-nums",
                  currentPnLBTC >= 0 ? "text-green-500" : "text-red-400",
                )}
              >
                {currentPnLBTC >= 0 ? "+" : ""}
                {currentPnLBTC.toFixed(4)} BTC
              </div>
            </div>
            <div className="text-center">
              <div className="text-[9px] font-mono text-muted-foreground">{t("roi")}</div>
              <div
                className={cn(
                  "text-sm font-mono font-semibold tabular-nums",
                  roi >= 0 ? "text-green-500" : "text-red-400",
                )}
              >
                {roi >= 0 ? "+" : ""}
                {Math.min(roi, 9900).toFixed(0)}%
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";

import { animate } from "framer-motion";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export function PayoffVisualization() {
  const t = useTranslations("Landing");

  // Configuration
  const strikePrice = 100000;
  const sizeBTC = 0.3;
  const premiumBTC = 0.003;
  const primaryColor = "#e86c3a";
  const priceMin = 80000;
  const priceMax = 140000;

  // Animation State
  const [progress, setProgress] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

  // Derived Values
  const pnlMin = -premiumBTC;
  const pnlMax = ((priceMax - strikePrice) / priceMax) * sizeBTC - premiumBTC;

  // Current "Spot" logic
  const spotPrice = priceMin + progress * (priceMax - priceMin);

  // PnL Calculation (Visual vs Math)
  // Math: Used for displaying the text values
  const calculatePnL = (S: number): number => {
    if (S <= strikePrice) {
      return -premiumBTC;
    }
    const intrinsicBTC = ((S - strikePrice) / S) * sizeBTC;
    return intrinsicBTC - premiumBTC;
  };

  const currentPnLBTC = calculatePnL(spotPrice);
  const roi = (currentPnLBTC / premiumBTC) * 100;

  // Scales (0 to 100 percentage)
  const xScale = (price: number) => ((price - priceMin) / (priceMax - priceMin)) * 100;
  const yScale = (pnl: number) => (1 - (pnl - pnlMin) / (pnlMax - pnlMin)) * 100;

  // Static Coordinates
  const xStart = xScale(priceMin);
  const xStrike = xScale(strikePrice);
  const xEnd = xScale(priceMax);
  const yLoss = yScale(-premiumBTC);
  const yWin = yScale(pnlMax);
  const yZero = yScale(0);
  const breakevenPrice = strikePrice + (premiumBTC / sizeBTC) * strikePrice;
  const xBreakeven = xScale(breakevenPrice);

  // Measure container size
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
      duration: 6,
      repeat: Infinity,
      ease: "linear",
      onUpdate: (value) => setProgress(value),
    });
    return () => controls.stop();
  }, []);

  // Determine Dot Position
  const currentX = xScale(spotPrice);

  // Visual Y Position: strictly follow the SVG lines
  // If price <= strike, follow the flat loss line
  // If price > strike, interpolate linearly between (xStrike, yLoss) and (xEnd, yWin)
  let currentYVisual: number;
  if (spotPrice <= strikePrice) {
    currentYVisual = yLoss;
  } else {
    // Linear interpolation based on X progress between strike and max
    const slope = (yWin - yLoss) / (xEnd - xStrike);
    currentYVisual = yLoss + (currentX - xStrike) * slope;
  }

  return (
    <div className="relative">
      <div className="relative">
        <div className="relative">
          <div className="flex items-center justify-end mb-4">
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
              7 {t("dayTimeframe")}
            </span>
          </div>

          <div ref={containerRef} className="h-[140px] relative mb-4 w-full">
            <svg
              className="w-full h-full overflow-visible"
              preserveAspectRatio="none"
              viewBox="0 0 100 100"
            >
              <title>Payoff Visualization Chart</title>
              <defs>
                <linearGradient id="profitGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={primaryColor} stopOpacity="0.2" />
                  <stop offset="100%" stopColor={primaryColor} stopOpacity="0" />
                </linearGradient>
              </defs>

              {/* Grid Lines */}
              {[100000, 120000, 140000].map((price) => (
                <line
                  key={price}
                  x1={xScale(price)}
                  y1={0}
                  x2={xScale(price)}
                  y2={100}
                  className="stroke-foreground/5"
                  strokeWidth="0.5"
                  vectorEffect="non-scaling-stroke"
                />
              ))}

              {/* Zero Line */}
              <line
                x1={0}
                y1={yZero}
                x2={100}
                y2={yZero}
                className="stroke-foreground/20"
                strokeWidth="1"
                strokeDasharray="4 4"
                vectorEffect="non-scaling-stroke"
              />

              {/* Profit Area */}
              <path
                d={`M ${xBreakeven} ${yZero} L ${xEnd} ${yWin} L ${xEnd} ${yZero} Z`}
                fill="url(#profitGradient)"
              />

              {/* Loss Line (Red) */}
              <line
                x1={xStart}
                y1={yLoss}
                x2={xStrike}
                y2={yLoss}
                stroke="rgba(239, 68, 68, 0.7)"
                strokeWidth="2.5"
                vectorEffect="non-scaling-stroke"
              />

              {/* Profit Line (Orange) */}
              <line
                x1={xStrike}
                y1={yLoss}
                x2={xEnd}
                y2={yWin}
                stroke={primaryColor}
                strokeWidth="3"
                vectorEffect="non-scaling-stroke"
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
                    <stop offset="0%" stopColor="#d4a574" stopOpacity="0.3" />
                    <stop offset="100%" stopColor="#d4a574" stopOpacity="0" />
                  </radialGradient>
                </defs>

                {/* Glowing Dot */}
                <circle
                  cx={(currentX / 100) * containerSize.width}
                  cy={(currentYVisual / 100) * containerSize.height}
                  r="20"
                  fill="url(#glowGradientOverlay)"
                />

                {/* Solid Dot */}
                <circle
                  cx={(currentX / 100) * containerSize.width}
                  cy={(currentYVisual / 100) * containerSize.height}
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

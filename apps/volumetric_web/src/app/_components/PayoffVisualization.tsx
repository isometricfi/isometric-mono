"use client";

import { motion } from "framer-motion";
import { useTheme } from "next-themes";
import { useEffect, useMemo, useRef, useState } from "react";

export function PayoffVisualization() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { resolvedTheme } = useTheme();

  const strikePrice = 100000;
  const sizeBTC = 0.3;
  const premiumBTC = 0.003;

  const primaryColor = "#e86c3a";

  const isDark = resolvedTheme === "dark";
  const gridColor = isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.08)";
  const zeroLineColor = isDark ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.2)";

  const priceMin = 80000;
  const priceMax = 140000;

  const [progress, setProgress] = useState(0);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [animationKey, setAnimationKey] = useState(0);
  const padding = { top: 20, right: 20, bottom: 20, left: 20 };

  const pnlMin = -premiumBTC;
  const pnlMax = ((priceMax - strikePrice) / priceMax) * sizeBTC - premiumBTC;

  const spotPrice = priceMin + progress * (priceMax - priceMin);

  const calculatePnL = (S: number): number => {
    if (S <= strikePrice) {
      return -premiumBTC;
    }
    const intrinsicBTC = ((S - strikePrice) / S) * sizeBTC;
    return intrinsicBTC - premiumBTC;
  };

  const currentPnLBTC = calculatePnL(spotPrice);
  const roi = (currentPnLBTC / premiumBTC) * 100;
  const inTheMoney = spotPrice > strikePrice;

  const strikeProgress = (strikePrice - priceMin) / (priceMax - priceMin);

  const totalDuration = 6;

  const animationKeyframes = useMemo(() => {
    if (dimensions.width === 0 || dimensions.height === 0) {
      return { x1: 0, x2: 0, x3: 0, y1: 0, y3: 0 };
    }

    const xScale = (price: number) => {
      return (
        padding.left +
        ((price - priceMin) / (priceMax - priceMin)) *
          (dimensions.width - padding.left - padding.right)
      );
    };

    const yScale = (pnl: number) => {
      return (
        dimensions.height -
        padding.bottom -
        ((pnl - pnlMin) / (pnlMax - pnlMin)) * (dimensions.height - padding.top - padding.bottom)
      );
    };

    return {
      x1: xScale(priceMin),
      x2: xScale(strikePrice),
      x3: xScale(priceMax),
      y1: yScale(-premiumBTC),
      y3: yScale(pnlMax),
    };
  }, [dimensions.width, dimensions.height, pnlMax, pnlMin]);

  const { x1, x2, x3, y1, y3 } = animationKeyframes;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const updateDimensions = () => {
      const rect = container.getBoundingClientRect();
      setDimensions({ width: rect.width, height: rect.height });
      setAnimationKey((prev) => prev + 1);
    };
    updateDimensions();
    window.addEventListener("resize", updateDimensions);
    return () => window.removeEventListener("resize", updateDimensions);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || dimensions.width === 0) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = dimensions.width * dpr;
    canvas.height = dimensions.height * dpr;
    ctx.scale(dpr, dpr);

    const { width, height } = dimensions;
    ctx.clearRect(0, 0, width, height);

    const xLocal = (price: number) =>
      padding.left +
      ((price - priceMin) / (priceMax - priceMin)) * (width - padding.left - padding.right);

    const yLocal = (pnl: number) =>
      height -
      padding.bottom -
      ((pnl - pnlMin) / (pnlMax - pnlMin)) * (height - padding.top - padding.bottom);

    ctx.strokeStyle = gridColor;
    ctx.lineWidth = 1;
    for (let price = 100000; price <= priceMax; price += 20000) {
      ctx.beginPath();
      ctx.moveTo(xLocal(price), padding.top);
      ctx.lineTo(xLocal(price), height - padding.bottom);
      ctx.stroke();
    }

    ctx.strokeStyle = zeroLineColor;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(padding.left, yLocal(0));
    ctx.lineTo(width - padding.right, yLocal(0));
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.beginPath();
    ctx.strokeStyle = "rgba(239, 68, 68, 0.7)";
    ctx.lineWidth = 2.5;
    ctx.moveTo(xLocal(priceMin), yLocal(-premiumBTC));
    ctx.lineTo(xLocal(strikePrice), yLocal(-premiumBTC));
    ctx.stroke();

    ctx.beginPath();
    ctx.strokeStyle = primaryColor;
    ctx.lineWidth = 3;
    ctx.moveTo(xLocal(strikePrice), yLocal(-premiumBTC));
    ctx.lineTo(xLocal(priceMax), yLocal(pnlMax));
    ctx.stroke();

    const breakevenPrice = strikePrice + (premiumBTC / sizeBTC) * strikePrice;
    ctx.beginPath();
    ctx.moveTo(xLocal(breakevenPrice), yLocal(0));
    ctx.lineTo(xLocal(priceMax), yLocal(pnlMax));
    ctx.lineTo(xLocal(priceMax), yLocal(0));
    ctx.closePath();
    const gradient = ctx.createLinearGradient(0, padding.top, 0, yLocal(0));
    gradient.addColorStop(0, `${primaryColor}30`);
    gradient.addColorStop(1, `${primaryColor}00`);
    ctx.fillStyle = gradient;
    ctx.fill();
  }, [dimensions, pnlMin, pnlMax, gridColor, zeroLineColor]);

  return (
    <div className="relative">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        viewport={{ once: true }}
        className="relative"
      >
        <div className="relative  ">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <motion.div
                className={`w-2 h-2 rounded-full ${inTheMoney ? "bg-green-500" : "bg-red-400"}`}
                animate={{ opacity: [1, 0.5, 1] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              />
              <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">
                {inTheMoney ? "In the Money" : "Out of Money"}
              </span>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
              7 Day Expiry
            </span>
          </div>

          <div ref={containerRef} className="h-[140px] relative mb-4">
            <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />

            {dimensions.width > 0 && (
              <>
                <motion.div
                  key={`glow-${animationKey}`}
                  className="absolute w-8 h-8 rounded-full pointer-events-none"
                  style={{
                    background:
                      "radial-gradient(circle, rgba(212,165,116,0.5) 0%, rgba(212,165,116,0) 70%)",
                  }}
                  animate={{
                    left: [x1 - 16, x2 - 16, x3 - 16],
                    top: [y1 - 16, y1 - 16, y3 - 16],
                  }}
                  transition={{
                    duration: totalDuration,
                    ease: "linear",
                    repeat: Infinity,
                    times: [0, strikeProgress, 1],
                  }}
                  onUpdate={(latest) => {
                    if (typeof latest.left === "number") {
                      const currentX = latest.left + 16;
                      const prog = (currentX - x1) / (x3 - x1);
                      setProgress(Math.max(0, Math.min(1, prog)));
                    }
                  }}
                />
                <motion.div
                  key={`dot-${animationKey}`}
                  className="absolute w-2.5 h-2.5 rounded-full bg-[#d4a574] pointer-events-none"
                  animate={{
                    left: [x1 - 5, x2 - 5, x3 - 5],
                    top: [y1 - 5, y1 - 5, y3 - 5],
                  }}
                  transition={{
                    duration: totalDuration,
                    ease: "linear",
                    repeat: Infinity,
                    times: [0, strikeProgress, 1],
                  }}
                />
              </>
            )}
          </div>

          <div className="grid grid-cols-3 gap-2 -mt-3">
            <div className="text-center">
              <div className="text-[9px] font-mono text-muted-foreground">SPOT</div>
              <div className="text-sm font-mono font-semibold tabular-nums">
                ${(spotPrice / 1000).toFixed(0)}K
              </div>
            </div>
            <div className="text-center">
              <div className="text-[9px] font-mono text-muted-foreground">P&L</div>
              <motion.div
                className={`text-sm font-mono font-semibold tabular-nums ${
                  currentPnLBTC >= 0 ? "text-green-500" : "text-red-400"
                }`}
                key={currentPnLBTC.toFixed(4)}
              >
                {currentPnLBTC >= 0 ? "+" : ""}
                {currentPnLBTC.toFixed(4)} BTC
              </motion.div>
            </div>
            <div className="text-center">
              <div className="text-[9px] font-mono text-muted-foreground">ROI</div>
              <div
                className={`text-sm font-mono font-semibold tabular-nums ${
                  roi >= 0 ? "text-green-500" : "text-red-400"
                }`}
              >
                {roi >= 0 ? "+" : ""}
                {Math.min(roi, 9900).toFixed(0)}%
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

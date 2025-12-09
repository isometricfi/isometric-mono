"use client";

import { Button } from "@/components/ui/button";
import { useTheme } from "next-themes";
import {
  ArrowRight,
  Sparkles,
  TrendingUp,
  Zap,
  Shield,
  Lock,
  CircleDot,
  Layers,
  Clock,
  ChevronRight,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState, useRef } from "react";
import { motion } from "framer-motion";

function ConcentricCircles() {
  const circles = [80, 140, 210, 290, 380, 480, 600];

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none top-0">
      <div className="absolute left-1/2  -translate-x-1/2 -translate-y-1/2 w-[2600px] h-[1600px]">
        {circles.map((size, i) => (
          <div
            key={size}
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-primary/20"
            style={{
              width: size,
              height: size,
              opacity: 1 - i * 0.12,
            }}
          />
        ))}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(circle at center, transparent 0%, transparent 20%, hsl(var(--background)) 70%)",
          }}
        />
      </div>
    </div>
  );
}

// floating yield display for writers
function YieldDisplay() {
  return (
    <div className="relative">
      {/* floating card with glassmorphism */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        viewport={{ once: true }}
        className="relative"
      >
        {/* main content */}
        <div className="relative ">
          {/* status bar */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">
                Active Position
              </span>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-primary/10 text-primary">
              CALL
            </span>
          </div>

          {/* yield display */}
          <div className="text-center mb-6">
            <div className="text-xs font-mono text-muted-foreground mb-1">
              ESTIMATED APY
            </div>
            <div className="text-5xl font-mono font-bold text-primary">
              24.8<span className="text-2xl text-primary/60">%</span>
            </div>
          </div>

          {/* position details */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-card rounded-xl p-5">
              <div className="text-[10px] font-mono text-muted-foreground mb-1">
                COLLATERAL
              </div>
              <div className="text-sm font-mono font-semibold">1.0 BTC</div>
            </div>
            <div className="bg-card rounded-xl p-5">
              <div className="text-[10px] font-mono text-muted-foreground mb-1">
                PREMIUM
              </div>
              <div className="text-sm font-mono font-semibold text-green-500">
                +0.021 BTC
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* floating secondary element */}
      {/* <motion.div
        initial={{ opacity: 0, x: 20 }}
        whileInView={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.6, delay: 0.2, ease: "easeOut" }}
        viewport={{ once: true }}
        className="absolute -right-4 -bottom-8 bg-gradient-to-br from-card/80 to-card/40 backdrop-blur-lg rounded-xl p-3 border border-white/10 shadow-xl"
      >
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-green-500/20 flex items-center justify-center">
            <TrendingUp className="w-4 h-4 text-green-500" />
          </div>
          <div>
            <div className="text-[9px] font-mono text-muted-foreground">
              COLLECTED
            </div>
            <div className="text-xs font-mono font-semibold">$2,184</div>
          </div>
        </div>
      </motion.div> */}
    </div>
  );
}

// animated payoff visualization for buyers
// linear payoff diagram for covered call buyer
function PayoffVisualization() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { resolvedTheme } = useTheme();

  // contract params
  const strikePrice = 100000; // K = $100k
  const sizeBTC = 0.3; // collateral size
  const premiumBTC = 0.003; // premium paid by buyer

  const primaryColor = "#e86c3a";

  // theme-aware colors (use resolvedTheme which handles "system" preference)
  const isDark = resolvedTheme === "dark";
  const gridColor = isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.08)";
  const zeroLineColor = isDark ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.2)";

  // chart bounds
  const priceMin = 80000;
  const priceMax = 140000; // more realistic max

  // animation progress 0-1 drives the whole animation
  const [progress, setProgress] = useState(0);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const padding = { top: 20, right: 20, bottom: 20, left: 20 };

  // P&L bounds
  const pnlMin = -premiumBTC; // max loss = premium
  // max P&L at priceMax using covered call formula: ((S-K)/S) * q - premium
  const pnlMax = ((priceMax - strikePrice) / priceMax) * sizeBTC - premiumBTC;

  // derive spot price from progress
  const spotPrice = priceMin + progress * (priceMax - priceMin);

  // P&L calculation
  // OTM (S <= K): P&L = -premium (flat line at bottom)
  // ITM (S > K): P&L increases based on covered call formula
  const calculatePnL = (S: number): number => {
    if (S <= strikePrice) {
      return -premiumBTC;
    }
    // covered call payout: ((S-K)/S) * q - premium
    const intrinsicBTC = ((S - strikePrice) / S) * sizeBTC;
    return intrinsicBTC - premiumBTC;
  };

  const currentPnLBTC = calculatePnL(spotPrice);
  const roi = (currentPnLBTC / premiumBTC) * 100;
  const inTheMoney = spotPrice > strikePrice;

  // scale functions
  const xScale = (price: number) => {
    if (dimensions.width === 0) return 0;
    return (
      padding.left +
      ((price - priceMin) / (priceMax - priceMin)) *
        (dimensions.width - padding.left - padding.right)
    );
  };

  const yScale = (pnl: number) => {
    if (dimensions.height === 0) return 0;
    return (
      dimensions.height -
      padding.bottom -
      ((pnl - pnlMin) / (pnlMax - pnlMin)) *
        (dimensions.height - padding.top - padding.bottom)
    );
  };

  // key points for animation keyframes
  const strikeProgress = (strikePrice - priceMin) / (priceMax - priceMin); // ~0.167

  // calculate keyframe positions once dimensions are known
  const x1 = xScale(priceMin); // start (OTM)
  const x2 = xScale(strikePrice); // strike point
  const x3 = xScale(priceMax); // end (max ITM)
  const y1 = yScale(-premiumBTC); // bottom (loss)
  const y3 = yScale(pnlMax); // top (max profit)

  // animation duration
  const totalDuration = 6; // seconds

  // measure container
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const updateDimensions = () => {
      const rect = container.getBoundingClientRect();
      setDimensions({ width: rect.width, height: rect.height });
    };
    updateDimensions();
    window.addEventListener("resize", updateDimensions);
    return () => window.removeEventListener("resize", updateDimensions);
  }, []);

  // draw chart (static - only dot moves)
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
      ((price - priceMin) / (priceMax - priceMin)) *
        (width - padding.left - padding.right);

    const yLocal = (pnl: number) =>
      height -
      padding.bottom -
      ((pnl - pnlMin) / (pnlMax - pnlMin)) *
        (height - padding.top - padding.bottom);

    // grid
    ctx.strokeStyle = gridColor;
    ctx.lineWidth = 1;
    for (let price = 100000; price <= priceMax; price += 20000) {
      ctx.beginPath();
      ctx.moveTo(xLocal(price), padding.top);
      ctx.lineTo(xLocal(price), height - padding.bottom);
      ctx.stroke();
    }

    // zero line (breakeven)
    ctx.strokeStyle = zeroLineColor;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(padding.left, yLocal(0));
    ctx.lineTo(width - padding.right, yLocal(0));
    ctx.stroke();
    ctx.setLineDash([]);

    // OTM region: flat line at -premium (RED)
    ctx.beginPath();
    ctx.strokeStyle = "rgba(239, 68, 68, 0.7)";
    ctx.lineWidth = 2.5;
    ctx.moveTo(xLocal(priceMin), yLocal(-premiumBTC));
    ctx.lineTo(xLocal(strikePrice), yLocal(-premiumBTC));
    ctx.stroke();

    // ITM region: line going up to priceMax (ORANGE)
    ctx.beginPath();
    ctx.strokeStyle = primaryColor;
    ctx.lineWidth = 3;
    ctx.moveTo(xLocal(strikePrice), yLocal(-premiumBTC));
    ctx.lineTo(xLocal(priceMax), yLocal(pnlMax));
    ctx.stroke();

    // gradient fill under profit region
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
  }, [
    dimensions,
    strikePrice,
    premiumBTC,
    sizeBTC,
    pnlMin,
    pnlMax,
    primaryColor,
    priceMin,
    priceMax,
    gridColor,
    zeroLineColor,
  ]);

  // dot position
  const dotX = xScale(spotPrice);
  const dotY = yScale(currentPnLBTC);

  return (
    <div className="relative">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        viewport={{ once: true }}
        className="relative"
      >
        {/* glow effect */}
        {/* <div className="absolute -inset-4 bg-linear-to-l from-accent/20 via-accent/10 to-transparent rounded-3xl blur-2xl" /> */}

        {/* main content */}
        <div className="relative  ">
          {/* header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <motion.div
                className={`w-2 h-2 rounded-full ${
                  inTheMoney ? "bg-green-500" : "bg-red-400"
                }`}
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

          {/* chart with framer motion dot */}
          <div ref={containerRef} className="h-[140px] relative mb-4">
            <canvas
              ref={canvasRef}
              className="absolute inset-0 w-full h-full"
            />

            {/* animated dot using framer motion keyframes */}
            {dimensions.width > 0 && (
              <>
                {/* glow */}
                <motion.div
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
                    // sync progress state from animation for stats display
                    if (typeof latest.left === "number") {
                      const currentX = latest.left + 16;
                      const prog = (currentX - x1) / (x3 - x1);
                      setProgress(Math.max(0, Math.min(1, prog)));
                    }
                  }}
                />
                {/* dot */}
                <motion.div
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

          {/* stats - P&L in BTC */}
          <div className="grid grid-cols-3 gap-2 -mt-3">
            <div className="text-center">
              <div className="text-[9px] font-mono text-muted-foreground">
                SPOT
              </div>
              <div className="text-sm font-mono font-semibold tabular-nums">
                ${(spotPrice / 1000).toFixed(0)}K
              </div>
            </div>
            <div className="text-center">
              <div className="text-[9px] font-mono text-muted-foreground">
                P&L
              </div>
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
              <div className="text-[9px] font-mono text-muted-foreground">
                ROI
              </div>
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

      {/* floating badge */}
      {/* <motion.div
        initial={{ opacity: 0, x: -20 }}
        whileInView={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.6, delay: 0.2, ease: "easeOut" }}
        viewport={{ once: true }}
        className="absolute -left-4 -bottom-6 bg-gradient-to-br from-card/80 to-card/40 backdrop-blur-lg rounded-xl p-3 border border-white/10 shadow-xl"
      >
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
            <Zap className="w-4 h-4 text-primary" />
          </div>
          <div>
            <div className="text-[9px] font-mono text-muted-foreground">
              MAX LOSS
            </div>
            <div className="text-xs font-mono font-semibold">
              {premiumBTC} BTC
            </div>
          </div>
        </div>
      </motion.div> */}
    </div>
  );
}

export default function Home() {
  return (
    <div className="relative mt-16 min-h-screen overflow-hidden">
      <ConcentricCircles />

      <div className="relative z-10 flex flex-col items-center px-4 pt-20 pb-16">
        <div className="max-w-5xl w-full">
          {/* eyebrow */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="flex justify-center mb-6"
          >
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium tracking-wide">
              <Sparkles className="size-4" />
              Now in public beta.
            </span>
          </motion.div>

          {/* main headline */}
          <h1 className="text-center text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.1] mb-6">
            Bitcoin Options <span className="text-primary">For Everyone.</span>
          </h1>

          {/* subheadline */}
          <h2 className="text-center text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-20">
            On-chain options trading. No intermediaries, no counterparty risk.
          </h2>

          {/* the two paths */}
          <div className="relative grid md:grid-cols-2 gap-16 md:gap-24 mb-20">
            {/* vertical divider line with fade */}
            <div className="hidden md:block absolute left-1/2 top-0 bottom-0 -translate-x-1/2 w-px">
              {/* radial gradient mask at top */}
              <div
                className="absolute -top-12 left-1/2 -translate-x-1/2 w-24 h-24 pointer-events-none z-10"
                style={{
                  background:
                    "radial-gradient(circle, hsl(var(--background)) 30%, transparent 70%)",
                }}
              />
              {/* the line - uses border color for light/dark mode */}
              <div
                className="absolute inset-0 bg-border"
                style={{
                  maskImage:
                    "linear-gradient(to bottom, transparent 0%, black 8%, black 92%, transparent 100%)",
                  WebkitMaskImage:
                    "linear-gradient(to bottom, transparent 0%, black 8%, black 92%, transparent 100%)",
                }}
              />
            </div>

            {/* writers / yield side */}
            <motion.div
              initial={{ opacity: 0, x: 0 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.7, ease: "easeOut", delay: 0.2 }}
              viewport={{ once: true }}
            >
              <div className="mb-8">
                <div className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-muted-foreground mb-3">
                  <TrendingUp className="size-3" />
                  for hodlers
                </div>
                <h2 className="text-3xl md:text-3xl font-bold mb-3">
                  Earn yield on idle assets
                </h2>
                <p className="text-muted-foreground">
                  Let your assets work for you. Write options and collect
                  premium instantly.
                </p>
              </div>

              <YieldDisplay />
            </motion.div>

            {/* buyers / leverage side */}
            <motion.div
              initial={{ opacity: 0, x: 0 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.7, ease: "easeOut", delay: 0.3 }}
              viewport={{ once: true }}
            >
              <div className="mb-8">
                <div className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-muted-foreground mb-3">
                  <Zap className="size-3" />
                  for traders
                </div>
                <h2 className="text-3xl md:text-3xl font-bold mb-3">
                  Leverage without liquidation
                </h2>
                <p className="text-muted-foreground">
                  Asymmetric exposure with defined risk. Your max loss is the
                  premium.
                </p>
              </div>

              <PayoffVisualization />
            </motion.div>
          </div>

          {/* trust badges */}
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            viewport={{ once: true }}
            className="flex flex-wrap items-center justify-center gap-6 md:gap-10 mt-12 text-sm text-muted-foreground"
          >
            <div className="flex items-center gap-2">
              <span className="text-xl">₿</span>
              <span>100% BTC-Native</span>
            </div>
            <div className="flex items-center gap-2">
              <Zap className="size-5 text-primary" />
              <span>Instant Settlement</span>
            </div>
          </motion.div>
        </div>
      </div>

      {/* chain abstraction section */}
      <ChainAbstractionSection />

      {/* how it works section */}
      <HowItWorksSection />
    </div>
  );
}

// visual components for feature cards
function SettlementVisual() {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <motion.div
        className="relative"
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
      >
        {/* btc symbol with orbiting elements */}
        <div className="relative w-24 h-24">
          <motion.div
            className="absolute inset-0 flex items-center justify-center text-4xl font-bold text-primary/80"
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          >
            ₿
          </motion.div>
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="absolute w-2 h-2 rounded-full bg-primary/40"
              style={{
                left: "50%",
                top: "50%",
              }}
              animate={{
                x: [
                  Math.cos((i * Math.PI * 2) / 3) * 40 - 4,
                  Math.cos((i * Math.PI * 2) / 3 + Math.PI * 2) * 40 - 4,
                ],
                y: [
                  Math.sin((i * Math.PI * 2) / 3) * 40 - 4,
                  Math.sin((i * Math.PI * 2) / 3 + Math.PI * 2) * 40 - 4,
                ],
              }}
              transition={{
                duration: 8,
                repeat: Infinity,
                ease: "linear",
                delay: i * 0.5,
              }}
            />
          ))}
        </div>
      </motion.div>
    </div>
  );
}

function RiskVisual() {
  return (
    <div className="absolute inset-0 flex items-center justify-center px-8">
      <div className="w-full max-w-[200px]">
        {/* simplified payoff diagram */}
        <svg viewBox="0 0 200 100" className="w-full h-auto">
          <defs>
            <linearGradient id="profitGrad" x1="0" y1="0" x2="0" y2="1">
              <stop
                offset="0%"
                stopColor="hsl(var(--primary))"
                stopOpacity="0.3"
              />
              <stop
                offset="100%"
                stopColor="hsl(var(--primary))"
                stopOpacity="0"
              />
            </linearGradient>
          </defs>
          {/* zero line */}
          <line
            x1="20"
            y1="60"
            x2="180"
            y2="60"
            stroke="currentColor"
            strokeOpacity="0.2"
            strokeDasharray="4 4"
          />
          {/* loss region - flat */}
          <motion.line
            x1="20"
            y1="75"
            x2="100"
            y2="75"
            stroke="hsl(var(--destructive))"
            strokeWidth="2"
            strokeLinecap="round"
            initial={{ pathLength: 0 }}
            whileInView={{ pathLength: 1 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            viewport={{ once: true }}
          />
          {/* profit region - going up */}
          <motion.path
            d="M100,75 L100,60 L180,20"
            fill="none"
            stroke="hsl(var(--primary))"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={{ pathLength: 0 }}
            whileInView={{ pathLength: 1 }}
            transition={{ duration: 0.8, delay: 0.6 }}
            viewport={{ once: true }}
          />
          {/* profit fill */}
          <motion.path
            d="M100,60 L180,20 L180,60 Z"
            fill="url(#profitGrad)"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 1 }}
            viewport={{ once: true }}
          />
          {/* labels */}
          <text x="30" y="90" className="text-[10px] fill-muted-foreground">
            Max loss
          </text>
          <text x="150" y="15" className="text-[10px] fill-primary">
            ∞ upside
          </text>
        </svg>
      </div>
    </div>
  );
}

function TrustVisual() {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="relative">
        {/* lock icon with shield layers */}
        <motion.div
          className="relative"
          initial={{ opacity: 0, scale: 0.8 }}
          whileInView={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          viewport={{ once: true }}
        >
          {/* outer rings */}
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="absolute rounded-full border border-primary/20"
              style={{
                width: 80 + i * 30,
                height: 80 + i * 30,
                left: `calc(50% - ${(80 + i * 30) / 2}px)`,
                top: `calc(50% - ${(80 + i * 30) / 2}px)`,
              }}
              animate={{
                opacity: [0.3, 0.6, 0.3],
                scale: [1, 1.02, 1],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                delay: i * 0.3,
              }}
            />
          ))}
          {/* center icon */}
          <div className="relative w-16 h-16 flex items-center justify-center bg-card rounded-xl border border-border">
            <Lock className="size-6 text-primary" />
          </div>
        </motion.div>
      </div>
    </div>
  );
}

// chain abstraction section - subtle icp mention
function ChainAbstractionSection() {
  return (
    <section className="relative px-4 py-24 md:py-32 bg-muted/30">
      <div className="max-w-5xl mx-auto">
        <div className="grid md:grid-cols-2 gap-12 md:gap-20">
          {/* left - content */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium mb-6">
              <Layers className="size-3" />
              Chain Abstraction
            </div>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-6">
              Native Bitcoin.
              <br />
              <span className="text-muted-foreground">
                Smart contract power.
              </span>
            </h2>
            <p className="text-muted-foreground leading-relaxed mb-8">
              Powered by ICP's chain-key technology, Volumetric bridges the gap
              between Bitcoin's security and programmable smart contracts. Your
              BTC never leaves the Bitcoin network—it's represented 1:1 on-chain
              with full cryptographic verification.
            </p>
            <div className="flex items-center gap-4">
              <Button variant="outline" size="sm" className="gap-2">
                Learn more
                <ArrowRight className="size-3" />
              </Button>
            </div>
          </motion.div>

          {/* right - visual */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            viewport={{ once: true }}
            className="relative"
          >
            <ChainAbstractionVisual />
          </motion.div>
        </div>
      </div>
    </section>
  );
}

function ChainAbstractionVisual() {
  return (
    <div className="relative h-[300px] grid grid-cols-3 items-center justify-center">
      {/* bitcoin side */}
      <motion.div
        className="absolute left-4 md:left-8 bg-card rounded-xl border border-border p-4"
        initial={{ opacity: 0, x: -20 }}
        whileInView={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5 }}
        viewport={{ once: true }}
      >
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-lg bg-[#F7931A]/10 flex items-center justify-center text-[#F7931A] font-bold">
            ₿
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Bitcoin</div>
            <div className="text-sm font-semibold">Your BTC</div>
          </div>
        </div>
        <div className="text-[10px] font-mono text-muted-foreground">
          bc1q...x7f9
        </div>
      </motion.div>

      {/* center - chain key */}
      <motion.div
        className="relative z-10 bg-card rounded-xl border border-primary/30 p-4"
        initial={{ opacity: 0, scale: 0.9 }}
        whileInView={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        viewport={{ once: true }}
      >
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10  rounded-full bg-green-500 animate-pulse" />
          <div>
            <div className="text-xs text-muted-foreground">Chain-Key</div>
            <div className="text-sm font-semibold">1:1 Verified</div>
          </div>
        </div>

        <div className="text-[10px] text-muted-foreground">
          Cryptographic proof
        </div>
      </motion.div>

      {/* smart contract side */}
      <motion.div
        className=" md:right-8 bg-card rounded-xl border border-border p-4"
        initial={{ opacity: 0, x: 0 }}
        whileInView={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5, delay: 0.4 }}
        viewport={{ once: true }}
      >
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Layers className="size-5 text-primary" />
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Contract</div>
            <div className="text-sm font-semibold">Options</div>
          </div>
        </div>
        <div className="text-[10px] font-mono text-muted-foreground">
          Auto-settlement
        </div>
      </motion.div>
    </div>
  );
}

// how it works section with toggle
function HowItWorksSection() {
  const [activeTab, setActiveTab] = useState<"writer" | "buyer">("writer");

  const writerSteps = [
    {
      step: "01",
      title: "Deposit Collateral",
      description:
        "Connect your wallet and deposit BTC as collateral. Funds are held in non-custodial smart contracts.",
    },
    {
      step: "02",
      title: "Write Options",
      description:
        "Select expiry, strike price, and size. Set your premium and list your covered call for buyers.",
    },
    {
      step: "03",
      title: "Collect Premium",
      description:
        "Earn yield instantly when buyers purchase your contracts. At expiry, collateral settles automatically.",
    },
  ];

  const buyerSteps = [
    {
      step: "01",
      title: "Connect & Deposit",
      description:
        "Link your wallet and deposit BTC. Your balance is used to pay premiums when purchasing options.",
    },
    {
      step: "02",
      title: "Browse & Purchase",
      description:
        "Explore available contracts by expiry and strike. Pay the premium from your balance to lock in exposure.",
    },
    {
      step: "03",
      title: "Automatic Settlement",
      description:
        "At expiry, profits are credited to your balance automatically. No manual claiming required.",
    },
  ];

  const steps = activeTab === "writer" ? writerSteps : buyerSteps;

  return (
    <section className="relative px-4 py-24 md:py-32">
      <div className="max-w-5xl mx-auto">
        {/* header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-muted text-muted-foreground text-xs font-medium mb-6">
            <Clock className="size-3" />
            Getting Started
          </div>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-8">
            Three steps to start trading
          </h2>

          {/* toggle */}
          <div className="inline-flex items-center p-1 rounded-full bg-muted">
            <button
              onClick={() => setActiveTab("writer")}
              className={`relative px-5 py-2 text-sm font-medium rounded-full transition-all ${
                activeTab === "writer"
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {activeTab === "writer" && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute inset-0 bg-background rounded-full shadow-sm"
                  transition={{ type: "spring", duration: 0.5 }}
                />
              )}
              <span className="relative z-10 flex items-center gap-2">
                <TrendingUp className="size-3.5" />
                Writers
              </span>
            </button>
            <button
              onClick={() => setActiveTab("buyer")}
              className={`relative px-5 py-2 text-sm font-medium rounded-full transition-all ${
                activeTab === "buyer"
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {activeTab === "buyer" && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute inset-0 bg-background rounded-full shadow-sm"
                  transition={{ type: "spring", duration: 0.5 }}
                />
              )}
              <span className="relative z-10 flex items-center gap-2">
                <Zap className="size-3.5" />
                Buyers
              </span>
            </button>
          </div>
        </motion.div>

        {/* steps */}
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="grid md:grid-cols-3 gap-8 md:gap-12"
        >
          {steps.map((item, i) => (
            <div key={item.step} className="relative">
              <div className="text-4xl font-bold text-muted-foreground/20 mb-4 font-mono">
                {item.step}
              </div>
              <h3 className="text-lg font-semibold mb-2">{item.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {item.description}
              </p>
            </div>
          ))}
        </motion.div>

        {/* cta */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          viewport={{ once: true }}
          className="flex justify-center mt-16"
        >
          <Button size="lg" className="gap-2">
            {activeTab === "writer" ? "Start Earning" : "Start Trading"}
            <ArrowRight className="size-4" />
          </Button>
        </motion.div>
      </div>
    </section>
  );
}

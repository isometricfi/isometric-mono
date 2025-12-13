"use client";

import { motion } from "framer-motion";
import { Sparkles, TrendingUp, Zap } from "lucide-react";
import { YieldDisplay } from "./YieldDisplay";
import { PayoffVisualization } from "./PayoffVisualization";

export function HeroSection() {
  return (
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
          Bitcoin Options{" "}
          <span className="text-primary block sm:inline">For Everyone.</span>
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
              {/* mobile horizontal divider */}
              <div className="md:hidden relative w-full h-px mb-6">
                {/* radial gradient mask */}
                <div
                  className="absolute -left-12 top-1/2 -translate-y-1/2 w-24 h-24 pointer-events-none z-10"
                  style={{
                    background:
                      "radial-gradient(circle, hsl(var(--background)) 30%, transparent 70%)",
                  }}
                />
                {/* the line */}
                <div
                  className="absolute inset-0 bg-border"
                  style={{
                    maskImage:
                      "linear-gradient(to right, transparent 0%, black 8%, black 92%, transparent 100%)",
                    WebkitMaskImage:
                      "linear-gradient(to right, transparent 0%, black 8%, black 92%, transparent 100%)",
                  }}
                />
              </div>

              <div className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-muted-foreground mb-3">
                <TrendingUp className="size-3" />
                for hodlers
              </div>
              <h2 className="text-2xl md:text-3xl font-bold mb-3">
                Earn yield on idle assets
              </h2>
              <p className="text-muted-foreground text-sm md:text-base">
                Let your assets work for you. Write options and collect premium
                instantly.
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
              {/* mobile horizontal divider */}
              <div className="md:hidden relative w-full h-px mb-6">
                {/* radial gradient mask */}
                <div
                  className="absolute -left-12 top-1/2 -translate-y-1/2 w-24 h-24 pointer-events-none z-10"
                  style={{
                    background:
                      "radial-gradient(circle, hsl(var(--background)) 30%, transparent 70%)",
                  }}
                />
                {/* the line */}
                <div
                  className="absolute inset-0 bg-border"
                  style={{
                    maskImage:
                      "linear-gradient(to right, transparent 0%, black 8%, black 92%, transparent 100%)",
                    WebkitMaskImage:
                      "linear-gradient(to right, transparent 0%, black 8%, black 92%, transparent 100%)",
                  }}
                />
              </div>

              <div className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-muted-foreground mb-3">
                <Zap className="size-3" />
                for traders
              </div>
              <h2 className="text-2xl md:text-3xl font-bold mb-3">
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
  );
}

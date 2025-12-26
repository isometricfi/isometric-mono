"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Calendar,
  CheckCircle,
  CircleArrowDown,
  Coins,
  Lock,
  Shield,
  Sparkles,
  Target,
  TrendingUp,
  XCircle,
  Zap,
} from "lucide-react";
import Image from "next/image";
import { useCallback, useState } from "react";
import { useMediaQuery } from "react-responsive";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Drawer, DrawerContent } from "@/components/ui/drawer";
import { useOnboarding } from "@/hooks/use-onboarding";
import { cn } from "@/lib/utils";

const SLIDE_DURATION = 0.4;
const CONTENT_HEIGHT = "min-h-[420px] md:min-h-[440px]";

interface SlideProps {
  direction: number;
  isActive: boolean;
}

function WelcomeSlide({ direction, isActive }: SlideProps) {
  return (
    <SlideWrapper direction={direction} isActive={isActive}>
      <div className="flex flex-col items-center text-center h-full justify-center">
        <motion.div
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ delay: 0.2, duration: 0.6, type: "spring", stiffness: 200 }}
          className="relative mb-8"
        >
          <div className="absolute inset-0 bg-primary/20 rounded-full blur-2xl scale-150" />
          <div className="relative size-24 rounded-full bg-card from-primary to-card/60 flex items-center justify-center">
            {/* <Bitcoin className="size-12 text-primary-foreground" /> */}
            <Image src="/logo.svg" alt="Volumetric" width={64} height={64} />
          </div>
          <motion.div
            className="absolute -top-2 -right-2"
            animate={{ y: [0, -4, 0], rotate: [0, 10, 0] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <Sparkles className="size-6 text-accent" />
          </motion.div>
        </motion.div>

        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="text-2xl md:text-3xl font-bold mb-3"
        >
          Welcome to Volumetric
        </motion.h2>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="text-muted-foreground max-w-sm"
        >
          Options let holders earn yield and buyers get leveraged exposure. Let's show you how.
        </motion.p>
      </div>
    </SlideWrapper>
  );
}

function DepositSlide({ direction, isActive }: SlideProps) {
  return (
    <SlideWrapper direction={direction} isActive={isActive}>
      <div className="flex flex-col h-full">
        <div className="text-center ">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 200 }}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-mono mb-4"
          >
            <CircleArrowDown className="size-3" />
            FIRST STEP
          </motion.div>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-xl md:text-2xl font-bold mb-2"
          >
            Your personal vault
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-muted-foreground text-sm"
          >
            Deposit BTC to unlock options trading
          </motion.p>
        </div>

        <div className="flex-1 flex flex-col justify-center space-y-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-card rounded-xl p-4 border"
          >
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-xl bg-green-500/10 flex items-center justify-center shrink-0">
                <TrendingUp className="size-5 text-green-500" />
              </div>
              <div>
                <p className="font-medium">Write options</p>
                <p className="text-sm text-muted-foreground">Earn yield on your holdings</p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-card rounded-xl p-4 border"
          >
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <Zap className="size-5 text-primary" />
              </div>
              <div>
                <p className="font-medium">Buy options</p>
                <p className="text-sm text-muted-foreground">Get leveraged exposure</p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-card rounded-xl p-4 border"
          >
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-xl bg-muted flex items-center justify-center shrink-0">
                <Lock className="size-5 text-muted-foreground" />
              </div>
              <div>
                <p className="font-medium">Fully decentralized</p>
                <p className="text-sm text-muted-foreground">
                  No custodians, deposit/withdraw anytime
                </p>
              </div>
            </div>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="p-3 rounded-xl bg-muted/50 text-center mt-4"
        >
          <p className="text-xs text-muted-foreground">
            Withdraw anytime — click your profile icon to manage funds
          </p>
        </motion.div>
      </div>
    </SlideWrapper>
  );
}

function TwoPathsSlide({ direction, isActive }: SlideProps) {
  return (
    <SlideWrapper direction={direction} isActive={isActive}>
      <div className="flex flex-col h-fit">
        <div className="text-center mb-4">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-xl md:text-2xl font-bold mb-2"
          >
            Two ways to profit
          </motion.h2>
        </div>

        <div className="flex-1 grid gap-4">
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="relative overflow-hidden rounded-2xl border bg-card p-5"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-linear-to-bl from-green-500/10 to-transparent rounded-bl-full" />
            <div className="flex items-start gap-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="font-semibold">Writer</h3>
                  <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-green-500/10 text-green-600 dark:text-green-400">
                    Up to 300% APY
                  </span>
                </div>
                <ul className="list-disc list-inside text-sm text-muted-foreground space-y-2">
                  <li>Deploy your BTC to earn option premiums</li>
                  <li>Profit when price stays within an expected range</li>
                  <li>Use time decay to your advantage</li>
                </ul>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
            className="relative overflow-hidden rounded-2xl border bg-card p-5"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-linear-to-bl from-primary/10 to-transparent rounded-bl-full" />

            <div className="flex items-start gap-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="font-semibold">Buyer</h3>
                  <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                    Up to 100x effective upside
                  </span>
                </div>
                <ul className="list-disc list-inside text-sm text-muted-foreground space-y-2">
                  <li>Buy exposure to upside without owning the asset</li>
                  <li>Win when volatility is higher than expected</li>
                  <li>Know your maximum loss from the start</li>
                </ul>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </SlideWrapper>
  );
}

function StrikePriceSlide({ direction, isActive }: SlideProps) {
  return (
    <SlideWrapper direction={direction} isActive={isActive}>
      <div className="flex flex-col h-full">
        <div className="text-center mb-4">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-xl md:text-2xl font-bold mb-2 flex items-center justify-center gap-2"
          >
            <Target className="size-5" />
            Strike Price
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-muted-foreground text-base"
          >
            The target price that determines the outcome
          </motion.p>
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          className=" bg-card rounded-2xl border p-5 h-fit"
        >
          <div className="text-center mb-4">
            <p className="text-base font-bold font-mono">BTC is currently $100,000</p>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-xl bg-muted/50">
              <span className="text-base">Strike: +5%</span>
              <span className="font-mono font-semibold">$105,000</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-xl bg-primary/10 border border-primary/20">
              <span className="text-base">Strike: +10%</span>
              <span className="font-mono font-semibold text-primary">$110,000</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-xl bg-muted/50">
              <span className="text-base">Strike: +15%</span>
              <span className="font-mono font-semibold">$115,000</span>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="grid grid-cols-2 gap-3 mt-4"
        >
          <div className="p-3 rounded-xl bg-green-500/10 text-center">
            <p className="text-sm mb-1">Writer</p>
            <p className="text-xs">Higher strike = safer, less premium</p>
          </div>
          <div className="p-3 rounded-xl bg-primary/10 text-center">
            <p className="text-[10px] text-muted-foreground mb-1">BUYER</p>
            <p className="text-xs">Lower strike = more likely to profit</p>
          </div>
        </motion.div>
      </div>
    </SlideWrapper>
  );
}

function PremiumSlide({ direction, isActive }: SlideProps) {
  return (
    <SlideWrapper direction={direction} isActive={isActive}>
      <div className="flex flex-col h-full">
        <div className="text-center mb-4">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 200 }}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted text-xs font-mono mb-3"
          >
            <Coins className="size-3" />
            KEY TERM
          </motion.div>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-xl md:text-2xl font-bold mb-2"
          >
            Premium
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-muted-foreground text-sm"
          >
            The price of the option contract
          </motion.p>
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          className="flex-1 bg-card rounded-2xl border p-5"
        >
          <div className="text-center mb-4">
            <p className="text-xs text-muted-foreground mb-1">Example: 1% premium on 0.3 BTC</p>
            <p className="text-2xl font-bold font-mono">0.003 BTC</p>
            <p className="text-xs text-muted-foreground">≈ $300</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="text-center p-4 rounded-xl bg-green-500/10"
            >
              <TrendingUp className="size-6 text-green-500 mx-auto mb-2" />
              <p className="text-xs text-muted-foreground mb-1">Writer receives</p>
              <p className="font-semibold text-green-600 dark:text-green-400">+0.003 BTC</p>
              <p className="text-[10px] text-muted-foreground mt-1">Instant income</p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="text-center p-4 rounded-xl bg-primary/10"
            >
              <Zap className="size-6 text-primary mx-auto mb-2" />
              <p className="text-xs text-muted-foreground mb-1">Buyer pays</p>
              <p className="font-semibold text-primary">-0.003 BTC</p>
              <p className="text-[10px] text-muted-foreground mt-1">Max possible loss</p>
            </motion.div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="p-3 rounded-xl bg-muted/50 text-center mt-4"
        >
          <p className="text-xs text-muted-foreground">
            Premium is paid upfront when the option is matched
          </p>
        </motion.div>
      </div>
    </SlideWrapper>
  );
}

function ExpirySlide({ direction, isActive }: SlideProps) {
  return (
    <SlideWrapper direction={direction} isActive={isActive}>
      <div className="flex flex-col h-full">
        <div className="text-center mb-4">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 200 }}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted text-xs font-mono mb-3"
          >
            <Calendar className="size-3" />
            KEY TERM
          </motion.div>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-xl md:text-2xl font-bold mb-2"
          >
            Expiry
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-muted-foreground text-sm"
          >
            How long until the option settles
          </motion.p>
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          className="flex-1 bg-card rounded-2xl border p-5"
        >
          <div className="flex justify-center gap-4 mb-6">
            <div className="text-center p-4 rounded-xl bg-muted/50 flex-1">
              <p className="text-2xl font-bold">7</p>
              <p className="text-xs text-muted-foreground">days</p>
            </div>
            <div className="text-center p-4 rounded-xl bg-primary/10 border border-primary/20 flex-1">
              <p className="text-2xl font-bold text-primary">14</p>
              <p className="text-xs text-muted-foreground">days</p>
            </div>
          </div>

          <div className="space-y-3">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="p-3 rounded-xl bg-muted/50"
            >
              <p className="text-sm text-center">
                <span className="font-medium">Shorter expiry</span>{" "}
                <span className="text-muted-foreground">= lower premium, less time to move</span>
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="p-3 rounded-xl bg-muted/50"
            >
              <p className="text-sm text-center">
                <span className="font-medium">Longer expiry</span>{" "}
                <span className="text-muted-foreground">= higher premium, more time to move</span>
              </p>
            </motion.div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="p-3 rounded-xl bg-muted/50 text-center mt-4"
        >
          <p className="text-xs text-muted-foreground">
            At expiry, the option is automatically settled
          </p>
        </motion.div>
      </div>
    </SlideWrapper>
  );
}

function SettlementSlide({ direction, isActive }: SlideProps) {
  return (
    <SlideWrapper direction={direction} isActive={isActive}>
      <div className="flex flex-col h-full">
        <div className="text-center mb-4">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 200 }}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted text-xs font-mono mb-3"
          >
            <Shield className="size-3" />
            AT EXPIRY
          </motion.div>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-xl md:text-2xl font-bold mb-2"
          >
            Settlement Outcomes
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-muted-foreground text-sm"
          >
            What happens when the option expires
          </motion.p>
        </div>

        <div className="flex-1 space-y-4">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-green-500/5 rounded-2xl border border-green-500/20 p-4"
          >
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle className="size-5 text-green-500" />
              <span className="font-semibold text-green-600 dark:text-green-400">
                In the Money (BTC above strike)
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-card rounded-xl p-3 text-center">
                <p className="text-[10px] text-muted-foreground mb-1">BUYER</p>
                <p className="text-sm font-medium text-green-600 dark:text-green-400">
                  Receives profit
                </p>
                <p className="text-[10px] text-muted-foreground">from price difference</p>
              </div>
              <div className="bg-card rounded-xl p-3 text-center">
                <p className="text-[10px] text-muted-foreground mb-1">WRITER</p>
                <p className="text-sm font-medium">Pays out profit</p>
                <p className="text-[10px] text-muted-foreground">keeps premium</p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-muted/30 rounded-2xl border p-4"
          >
            <div className="flex items-center gap-2 mb-3">
              <XCircle className="size-5 text-muted-foreground" />
              <span className="font-semibold">Out of the Money (BTC below strike)</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-card rounded-xl p-3 text-center">
                <p className="text-[10px] text-muted-foreground mb-1">BUYER</p>
                <p className="text-sm font-medium text-red-500">Loses premium</p>
                <p className="text-[10px] text-muted-foreground">nothing else</p>
              </div>
              <div className="bg-card rounded-xl p-3 text-center">
                <p className="text-[10px] text-muted-foreground mb-1">WRITER</p>
                <p className="text-sm font-medium text-green-600 dark:text-green-400">
                  Keeps everything
                </p>
                <p className="text-[10px] text-muted-foreground">premium + collateral</p>
              </div>
            </div>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="p-3 rounded-xl bg-muted/50 text-center mt-4"
        >
          <p className="text-xs text-muted-foreground">
            Settlement is automatic — no action needed from you
          </p>
        </motion.div>
      </div>
    </SlideWrapper>
  );
}

function ReadySlide({ direction, isActive }: SlideProps) {
  return (
    <SlideWrapper direction={direction} isActive={isActive}>
      <div className="flex flex-col items-center text-center h-full justify-center">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 200 }}
          className="relative mb-8"
        >
          <motion.div
            className="absolute inset-0 rounded-full"
            animate={{
              boxShadow: [
                "0 0 0 0 rgba(232, 108, 58, 0.4)",
                "0 0 0 20px rgba(232, 108, 58, 0)",
                "0 0 0 0 rgba(232, 108, 58, 0)",
              ],
            }}
            transition={{ duration: 2, repeat: Infinity }}
          />
          <div className="relative size-20 rounded-full bg-linear-to-br from-primary to-primary/60 flex items-center justify-center">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
            >
              <Sparkles className="size-10 text-primary-foreground" />
            </motion.div>
          </div>
        </motion.div>

        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-2xl md:text-3xl font-bold mb-3"
        >
          You're Ready!
        </motion.h2>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="text-muted-foreground max-w-sm mb-8"
        >
          Deposit BTC to start earning yield or getting leveraged exposure.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="grid grid-cols-2 gap-3 w-full max-w-xs"
        >
          <div className="bg-card rounded-xl p-4 border text-center">
            <p className="text-xs text-muted-foreground mb-1">Writers earn</p>
            <p className="text-lg font-bold text-green-500">~25% APY</p>
          </div>
          <div className="bg-card rounded-xl p-4 border text-center">
            <p className="text-xs text-muted-foreground mb-1">Buyers get</p>
            <p className="text-lg font-bold text-primary">100x leverage</p>
          </div>
        </motion.div>
      </div>
    </SlideWrapper>
  );
}

function SlideWrapper({
  children,
  direction,
  isActive,
}: {
  children: React.ReactNode;
  direction: number;
  isActive: boolean;
}) {
  if (!isActive) return null;

  return (
    <motion.div
      initial={{ x: direction > 0 ? 300 : -300, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: direction > 0 ? -300 : 300, opacity: 0 }}
      transition={{ duration: SLIDE_DURATION, ease: [0.32, 0.72, 0, 1] }}
      className={cn("w-full h-full", CONTENT_HEIGHT)}
    >
      {children}
    </motion.div>
  );
}

const SLIDE_KEYS = [
  "welcome",
  "deposit",
  "paths",
  "strike",
  "premium",
  "expiry",
  "settlement",
  "ready",
] as const;

function ProgressDots({
  current,
  onDotClick,
}: {
  current: number;
  onDotClick: (index: number) => void;
}) {
  return (
    <div className="flex items-center justify-center gap-1.5">
      {SLIDE_KEYS.map((key, i) => (
        <button
          key={key}
          type="button"
          onClick={() => onDotClick(i)}
          className={cn(
            "transition-all duration-300 rounded-full",
            i === current
              ? "w-6 h-1.5 bg-primary"
              : "size-1.5 bg-muted hover:bg-muted-foreground/30",
          )}
        />
      ))}
    </div>
  );
}

function OnboardingContent() {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [direction, setDirection] = useState(1);
  const { completeOnboarding } = useOnboarding();

  const isLastSlide = currentSlide === SLIDE_KEYS.length - 1;
  const isFirstSlide = currentSlide === 0;

  const goToSlide = useCallback(
    (index: number) => {
      setDirection(index > currentSlide ? 1 : -1);
      setCurrentSlide(index);
    },
    [currentSlide],
  );

  const nextSlide = useCallback(() => {
    if (isLastSlide) {
      completeOnboarding();
    } else {
      setDirection(1);
      setCurrentSlide((prev) => prev + 1);
    }
  }, [isLastSlide, completeOnboarding]);

  const prevSlide = useCallback(() => {
    if (!isFirstSlide) {
      setDirection(-1);
      setCurrentSlide((prev) => prev - 1);
    }
  }, [isFirstSlide]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-4">
        <ProgressDots current={currentSlide} onDotClick={goToSlide} />
        {!isLastSlide && (
          <button
            type="button"
            onClick={completeOnboarding}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Skip
          </button>
        )}
      </div>

      <div className={cn("flex-1 overflow-hidden relative", CONTENT_HEIGHT)}>
        <AnimatePresence mode="wait" initial={false}>
          <WelcomeSlide key="welcome" direction={direction} isActive={currentSlide === 0} />
          <TwoPathsSlide key="paths" direction={direction} isActive={currentSlide === 1} />
          <StrikePriceSlide key="strike" direction={direction} isActive={currentSlide === 2} />
          <PremiumSlide key="premium" direction={direction} isActive={currentSlide === 3} />
          <ExpirySlide key="expiry" direction={direction} isActive={currentSlide === 4} />
          <SettlementSlide key="settlement" direction={direction} isActive={currentSlide === 5} />
          <DepositSlide key="deposit" direction={direction} isActive={currentSlide === 6} />

          <ReadySlide key="ready" direction={direction} isActive={currentSlide === 7} />
        </AnimatePresence>
      </div>

      <div className="pt-4 flex gap-2">
        {!isFirstSlide && (
          <Button variant="outline" size="icon" onClick={prevSlide} className="shrink-0">
            <ArrowLeft className="size-4" />
          </Button>
        )}
        <Button onClick={nextSlide} className="flex-1 gap-2">
          {isLastSlide ? (
            <>
              Get Started
              <Sparkles className="size-4" />
            </>
          ) : (
            <>
              Continue
              <ArrowRight className="size-4" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

export function OnboardingModal() {
  const { showOnboarding, closeOnboarding } = useOnboarding();
  const isMobile = useMediaQuery({ query: "(max-width: 768px)" });

  if (isMobile) {
    return (
      <Drawer open={showOnboarding} onOpenChange={(open) => !open && closeOnboarding()}>
        <DrawerContent className="px-6 pb-6 pt-4 max-h-[92vh]">
          <OnboardingContent />
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={showOnboarding} onOpenChange={(open) => !open && closeOnboarding()}>
      <DialogContent showCloseButton={false} className="sm:max-w-md p-6 min-h-[620px]">
        <OnboardingContent />
      </DialogContent>
    </Dialog>
  );
}

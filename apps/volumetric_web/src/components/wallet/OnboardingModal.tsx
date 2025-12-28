"use client";

import { motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  BatteryCharging,
  Calendar,
  CheckCircle,
  Coins,
  Handshake,
  Hash,
  Lock,
  PencilLine,
  PiggyBank,
  Scale,
  ShoppingCart,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
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

// 0. Welcome: Intro
function WelcomeSlide() {
  return (
    <SlideWrapper>
      <div className="flex flex-col items-center text-center h-full justify-center">
        <div className="relative mb-10">
          <div className="absolute inset-0 bg-primary/20 rounded-full blur-3xl" />
          <div className="relative size-32 rounded-3xl bg-card border shadow-xl flex items-center justify-center">
            <Image src="/logo.svg" alt="Volumetric" width={80} height={80} className="w-20 h-20" />
          </div>
        </div>

        <h1 className="text-4xl font-bold mb-4 tracking-tight">Volumetric</h1>

        <p className="text-lg text-muted-foreground max-w-xs leading-relaxed">
          The simplest way to trade Bitcoin options on-chain.
        </p>
        {/* <div className="flex items-center justify-center gap-2 text-sm text-primary/80 font-medium mt-4">
          <Shield className="size-4" />
          <span>Decentralized & Trustless</span>
        </div> */}
      </div>
    </SlideWrapper>
  );
}

// 1. Concept: The Agreement
function ConceptSlide() {
  return (
    <SlideWrapper>
      <div className="flex flex-col items-center text-center h-full justify-center">
        <div className="relative mb-10">
          <div className="absolute inset-0 bg-primary/20 rounded-full blur-3xl" />
          <div className="relative size-32 rounded-3xl bg-card border shadow-xl flex items-center justify-center">
            <Handshake className="w-16 h-16 text-primary" />
          </div>
        </div>

        <h2 className="text-3xl font-bold mb-4 tracking-tight">What is an option?</h2>

        <div className="max-w-xs space-y-6">
          <p className="text-lg text-muted-foreground leading-relaxed">
            It's simply an <span className="text-foreground font-medium">agreement</span> to buy
            Bitcoin later, at a price set today.
          </p>
          <div className="pt-5 border-t border-border/50">
            <p className="text-base font-medium text-primary">Every option has 4 key terms...</p>
          </div>
        </div>
      </div>
    </SlideWrapper>
  );
}

// 2a. Term: Strike Price
function TermStrikeSlide() {
  return (
    <SlideWrapper>
      <div className="flex flex-col items-center text-center h-full ">
        {/* Visual */}
        <div className="relative mb-8">
          <div className="size-20 rounded-2xl bg-muted border flex items-center justify-center shadow-sm">
            <Target className="size-10 text-foreground" />
          </div>
          <div className="absolute -bottom-3 -right-3 bg-background border px-2 py-1 rounded-md text-xs font-mono font-bold shadow-sm">
            $110k
          </div>
        </div>

        <h2 className="text-2xl font-bold mb-4">1. Strike Price</h2>
        <p className="text-muted-foreground max-w-xs mb-8 leading-relaxed">
          The target price Bitcoin must reach for the contract to be valuable.
        </p>

        <div className="grid grid-cols-2 gap-3 w-full  text-sm">
          <div className="bg-primary/5 p-3 rounded-xl border border-primary/10 flex flex-col items-center justify-between">
            <TrendingUp className="size-6 text-primary opacity-50 " />

            <p className="  font-bold text-primary mb-1">Buyer wants</p>
            <p className=" font-medium">Price above strike</p>
          </div>
          <div className="bg-green-500/5 p-3 rounded-xl border border-green-500/10 flex flex-col items-center justify-between">
            <TrendingDown className="size-6 text-green-600 opacity-50" />

            <p className="  font-bold text-green-600 dark:text-green-400 mb-1">Writer wants</p>
            <p className=" font-medium">Price below strike</p>
          </div>
        </div>
      </div>
    </SlideWrapper>
  );
}

// 2b. Term: Amount
function TermAmountSlide() {
  return (
    <SlideWrapper>
      <div className="flex flex-col items-center text-center h-full">
        <div className="relative mb-8">
          <div className="size-20 rounded-2xl bg-muted border flex items-center justify-center shadow-sm">
            <Hash className="size-10" />
          </div>
          <div className="absolute -bottom-3 -right-3 bg-background border px-2 py-1 rounded-md text-xs font-mono font-bold shadow-sm">
            1 BTC
          </div>
        </div>

        <h2 className="text-2xl font-bold mb-4">2. Amount</h2>
        <p className="text-muted-foreground  mb-8 leading-relaxed">
          The quantity of Bitcoin this contract controls.
        </p>
        <div className="grid grid-cols-2 gap-3 w-full text-sm">
          <div className="bg-primary/5 p-3 rounded-xl border border-primary/10 flex flex-col items-center justify-between">
            <BatteryCharging className="size-6 text-primary opacity-50 mb-1" />
            <p className="font-bold text-primary mb-1">Buyer</p>
            <p className="font-medium">Gains exposure</p>
          </div>
          <div className="bg-green-500/5 p-3 rounded-xl border border-green-500/10 flex flex-col items-center justify-between">
            <Lock className="size-6 text-green-600 opacity-50 mb-1" />
            <p className="font-bold text-green-600 dark:text-green-400 mb-1">Writer</p>
            <p className="font-medium">Locks as collateral</p>
          </div>
        </div>
      </div>
    </SlideWrapper>
  );
}

// 2c. Term: Premium
function TermPremiumSlide() {
  return (
    <SlideWrapper>
      <div className="flex flex-col items-center text-center h-full">
        <div className="relative mb-8">
          <div className="size-20 rounded-2xl bg-muted border flex items-center justify-center shadow-sm">
            <Coins className="size-10" />
          </div>
          <div className="absolute -bottom-3 -right-5 bg-background border px-2 py-1 rounded-md text-xs font-mono font-bold shadow-sm">
            0.005 BTC
          </div>
        </div>

        <h2 className="text-2xl font-bold mb-4">3. Premium</h2>
        <p className="text-muted-foreground max-w-xs mb-8 leading-relaxed">
          The upfront price paid to enter the contract.
        </p>
        <div className="grid grid-cols-2 gap-3 w-full  text-sm">
          <div className="bg-primary/5 p-3 rounded-xl border border-primary/10 flex flex-col items-center justify-between">
            <ShoppingCart className="size-6 text-primary opacity-50 mb-1" />
            <p className="  font-bold text-primary mb-1">Buyer</p>
            <p className=" font-medium">Pays premium</p>
          </div>
          <div className="bg-green-500/5 p-3 rounded-xl border border-green-500/10 flex flex-col items-center justify-between">
            <PiggyBank className="size-6 text-green-600 opacity-50 mb-1" />
            <p className="  font-bold text-green-600 dark:text-green-400 mb-1">Writer</p>
            <p className=" font-medium">Collects premium</p>
          </div>
        </div>
      </div>
    </SlideWrapper>
  );
}

// 2d. Term: Expiry
function TermExpirySlide() {
  return (
    <SlideWrapper>
      <div className="flex flex-col items-center text-center h-full">
        <div className="relative mb-8">
          <div className="size-20 rounded-2xl bg-muted border flex items-center justify-center shadow-sm">
            <Calendar className="size-10" />
          </div>
          <div className="absolute -bottom-3 -right-3 bg-background border px-2 py-1 rounded-md text-xs font-mono font-bold shadow-sm">
            7 Days
          </div>
        </div>

        <h2 className="text-2xl font-bold mb-4">4. Term</h2>
        <p className="text-muted-foreground mb-8 leading-relaxed">
          How long the contract lasts before it settles.
        </p>
        <div className="bg-card p-3 w-full text-sm px-5 rounded-xl border border-muted-foreground/20 flex flex-col items-center justify-between">
          <Scale className="size-6 text-muted-foreground opacity-50 mb-1" />
          <p className="  font-bold  mb-1">Auto-settlement</p>
          <p className=" font-medium text-muted-foreground">
            At expiry, the contract settles automatically
          </p>
        </div>
      </div>
    </SlideWrapper>
  );
}

// 3. Mechanics: The Exchange
function MechanicsSlide() {
  return (
    <SlideWrapper>
      <div className="flex flex-col h-full">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold mb-2">The Exchange</h2>
          <p className="text-muted-foreground">How the lifecycle works</p>
        </div>

        <div className="flex-1 flex justify-center items-center">
          <div className="relative w-full max-w-[300px]">
            {/* Vertical Line */}
            <div className="absolute left-[19px] top-4 bottom-8 w-0.5 bg-border -z-10" />

            <div className="space-y-8">
              {/* Step 1: Writer */}
              <div className="flex items-start gap-4">
                <div className="size-10 rounded-full bg-green-500 flex items-center justify-center shrink-0 ring-4 ring-background z-10">
                  <PencilLine className="size-5 text-white" />
                </div>
                <div className="pt-1">
                  <p className="font-bold text-sm mb-0.5">1. Writer Creates Offer</p>
                  <p className="text-xs text-muted-foreground leading-snug">
                    Sets terms: strike, premium, expiry.
                  </p>
                </div>
              </div>

              {/* Step 2: Buyer */}
              <div className="flex items-start gap-4">
                <div className="size-10 rounded-full bg-primary flex items-center justify-center shrink-0 ring-4 ring-background z-10">
                  <Zap className="size-5 text-primary-foreground" />
                </div>
                <div className="pt-1">
                  <p className="font-bold text-sm mb-0.5">2. Buyer Accepts</p>
                  <p className="text-xs text-muted-foreground leading-snug">
                    Pays premium. Collateral locks instantly.
                  </p>
                </div>
              </div>

              {/* Step 3: Contract */}
              <div className="flex items-start gap-4">
                <div className="size-10 rounded-full bg-muted border flex items-center justify-center shrink-0 ring-4 ring-background z-10">
                  <Lock className="size-5 text-foreground" />
                </div>
                <div className="pt-1">
                  <p className="font-bold text-sm mb-0.5">3. Active Contract</p>
                  <p className="text-xs text-muted-foreground leading-snug">
                    Collateral secured until expiry.
                  </p>
                </div>
              </div>

              {/* Step 4: Settlement */}
              <div className="flex items-start gap-4">
                <div className="size-10 rounded-full bg-muted border flex items-center justify-center shrink-0 ring-4 ring-background z-10">
                  <Scale className="size-5 text-foreground" />
                </div>
                <div className="pt-1">
                  <p className="font-bold text-sm mb-0.5">4. Auto-Settlement</p>
                  <p className="text-xs text-muted-foreground leading-snug">
                    Payout calculated at expiry.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </SlideWrapper>
  );
}

// 4. Scenario: ITM
function ScenarioITMSlide() {
  return (
    <SlideWrapper>
      <div className="flex flex-col h-full">
        <div className="text-center mb-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-green-500/10 text-green-600 dark:text-green-400 rounded-full text-xs font-bold uppercase tracking-wider mb-1">
            Scenario A
          </div>
          <h2 className="text-2xl font-bold mb-2">Price rises</h2>
          <p className="text-muted-foreground">BTC goes above the strike price</p>
        </div>

        <div className="flex-1 flex flex-col justify-center gap-6">
          <div className="relative h-32 w-full bg-card border rounded-xl overflow-hidden">
            <div className="absolute top-1/2 inset-x-0 h-px bg-muted-foreground/30 border-t border-dashed" />
            <span className="absolute top-[45%] right-2 text-xs text-muted-foreground bg-muted px-1 rounded-sm">
              Stike $100,000
            </span>

            <svg
              className="absolute inset-0 size-full"
              viewBox="0 0 100 50"
              preserveAspectRatio="none"
              aria-labelledby="itm-chart-title"
            >
              <title id="itm-chart-title">In the Money Chart</title>
              <motion.path
                d="M 0 40 L 30 40 L 60 10 L 100 5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="text-green-500"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 1.5, ease: "easeInOut" }}
              />
              <motion.path
                d="M 0 40 L 30 40 L 60 10 L 100 5 V 50 H 0 Z"
                fill="url(#gradient-green)"
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.2 }}
                transition={{ delay: 1, duration: 0.5 }}
              />
              <defs>
                <linearGradient id="gradient-green" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#22c55e" />
                  <stop offset="100%" stopColor="#22c55e" stopOpacity="0" />
                </linearGradient>
              </defs>
            </svg>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 text-center">
              <Zap className="size-6 text-primary mx-auto mb-2" />
              <p className="font-bold text-sm mb-1">Buyer Wins</p>
              <p className="text-xs text-muted-foreground">Profits from the price difference</p>
            </div>

            <div className="bg-card border rounded-xl p-4 text-center">
              <PencilLine className="size-6 text-muted-foreground mx-auto mb-2" />
              <p className="font-bold text-sm mb-1">Writer Caps</p>
              <p className="text-xs text-muted-foreground">Keeps premium, pays out excess</p>
            </div>
          </div>
        </div>
      </div>
    </SlideWrapper>
  );
}

// 4b. Scenario: ITM Payout
function ScenarioITMPayoutSlide() {
  return (
    <SlideWrapper>
      <div className="flex flex-col h-full">
        <div className="text-center mb-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-green-500/10 text-green-600 dark:text-green-400 rounded-full text-xs font-bold uppercase tracking-wider mb-1">
            Scenario A
          </div>
          <h2 className="text-2xl font-bold mb-1">Example payout</h2>
          <p className="text-sm text-muted-foreground">Strike: $100k → Settles: $105k (+5%)</p>
        </div>

        <div className="flex-1 flex flex-col justify-center gap-3">
          <div className="bg-primary/5 border border-primary/20 rounded-xl p-4">
            <div className="flex items-center justify-center gap-1 mb-3">
              <Zap className="size-4 text-primary" />
              <p className="font-bold text-sm">Buyer</p>
            </div>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Premium paid</span>
                <span className="font-mono ">-0.01 BTC</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Payout received</span>
                <span className="font-mono">+0.05 BTC</span>
              </div>
              <div className="h-px bg-border" />
              <div className="flex justify-between items-center">
                <span className="font-medium">Net profit</span>
                <div className="text-right">
                  <span className="font-mono font-bold text-green-500">+0.04 BTC</span>
                  <span className="text-sm text-green-600 ml-2">+400%</span>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-card border rounded-xl p-4">
            <div className="flex items-center justify-center gap-1 mb-3">
              <PencilLine className="size-4 text-muted-foreground" />
              <p className="font-bold text-sm">Writer</p>
            </div>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Collateral locked</span>
                <span className="font-mono">1.00 BTC</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Premium earned</span>
                <span className="font-mono text-green-500">+0.01 BTC</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Paid to buyer</span>
                <span className="font-mono text-red-500">-0.05 BTC</span>
              </div>
              <div className="h-px bg-border" />
              <div className="flex justify-between items-center">
                <span className="font-medium">Net result </span>
                <span className="font-mono font-bold">0.96 BTC</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </SlideWrapper>
  );
}

// 5. Scenario: OTM
function ScenarioOTMSlide() {
  return (
    <SlideWrapper>
      <div className="flex flex-col h-full">
        <div className="text-center mb-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-muted text-muted-foreground rounded-full text-xs font-bold uppercase tracking-wider mb-1">
            Scenario B
          </div>
          <h2 className="text-2xl font-bold mb-2">Price stays low</h2>
          <p className="text-muted-foreground">BTC stays below the strike price</p>
        </div>

        <div className="flex-1 flex flex-col justify-center gap-6">
          <div className="relative h-32 w-full bg-card border rounded-xl overflow-hidden">
            <div className="absolute top-1/2 inset-x-0 h-px bg-muted-foreground/30 border-t border-dashed" />
            <span className="absolute top-[45%] right-2 text-xs text-muted-foreground bg-muted px-1 rounded-sm">
              Stike $100,000
            </span>

            <svg
              className="absolute inset-0 size-full"
              viewBox="0 0 100 50"
              preserveAspectRatio="none"
              aria-labelledby="otm-chart-title"
            >
              <title id="otm-chart-title">Out of the Money Chart</title>
              <motion.path
                d="M 0 40 L 40 35 L 70 42 L 100 38"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="text-muted-foreground"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 1.5, ease: "easeInOut" }}
              />
              <motion.path
                d="M 0 40 L 40 35 L 70 42 L 100 38 V 50 H 0 Z"
                fill="url(#gradient-gray)"
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.3 }}
                transition={{ delay: 1.1, duration: 0.5 }}
              />
              <defs>
                <linearGradient id="gradient-gray" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="currentColor" className="text-muted-foreground" />
                  <stop
                    offset="100%"
                    stopColor="currentColor"
                    stopOpacity="0"
                    className="text-muted-foreground"
                  />
                </linearGradient>
              </defs>
            </svg>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-card border rounded-xl p-4 text-center">
              <Zap className="size-6 text-muted-foreground mx-auto mb-2" />
              <p className="font-bold text-sm mb-1">Buyer Loses</p>
              <p className="text-xs text-muted-foreground">Premium is lost. Option expires.</p>
            </div>

            <div className="bg-green-500/5 border border-green-500/20 rounded-xl p-4 text-center">
              <PencilLine className="size-6 text-green-500 mx-auto mb-2" />
              <p className="font-bold text-sm mb-1">Writer Wins</p>
              <p className="text-xs text-muted-foreground">Keeps premium + 100% collateral</p>
            </div>
          </div>
        </div>
      </div>
    </SlideWrapper>
  );
}

// 5b. Scenario: OTM Payout
function ScenarioOTMPayoutSlide() {
  return (
    <SlideWrapper>
      <div className="flex flex-col h-full">
        <div className="text-center mb-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-muted text-muted-foreground rounded-full text-xs font-bold uppercase tracking-wider  mb-1">
            Scenario B
          </div>
          <h2 className="text-2xl font-bold mb-1">Example Payout</h2>
          <p className="text-sm text-muted-foreground">Strike: $100k → Settles: $95k (-5%)</p>
        </div>

        <div className="flex-1 flex flex-col justify-center gap-3">
          <div className="bg-card border rounded-xl p-4">
            <div className="flex items-center justify-center gap-1 mb-3">
              <Zap className="size-4 text-muted-foreground" />
              <p className="font-bold text-sm">Buyer</p>
            </div>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Premium paid</span>
                <span className="font-mono text-red-500">-0.01 BTC</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Payout received</span>
                <span className="font-mono">0.00 BTC</span>
              </div>
              <div className="h-px bg-border" />
              <div className="flex justify-between items-center">
                <span className="font-medium">Net loss</span>
                <div className="text-right">
                  <span className="font-mono font-bold text-red-500">-0.01 BTC</span>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-green-500/5 border border-green-500/20 rounded-xl p-4">
            <div className="flex items-center justify-center gap-1 mb-3">
              <PencilLine className="size-4 text-green-500" />
              <p className="font-bold text-sm">Writer</p>
            </div>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Collateral locked</span>
                <span className="font-mono">1.00 BTC</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Premium earned</span>
                <span className="font-mono text-green-500">+0.01 BTC</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Paid to buyer</span>
                <span className="font-mono">0.00 BTC</span>
              </div>
              <div className="h-px bg-border" />
              <div className="flex justify-between items-center">
                <span className="font-medium">Returned</span>
                <div className="text-right">
                  <span className="font-mono font-bold text-green-500">1.01 BTC</span>
                  <span className="text-sm text-green-600 ml-2">68% APY</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </SlideWrapper>
  );
}

// 6. Roles: Writer vs Buyer
function RolesSlide() {
  return (
    <SlideWrapper>
      <div className="flex flex-col h-full">
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold mb-2">Choose Your Side</h2>
          <p className="text-muted-foreground">Strategies for different market views</p>
        </div>

        <div className="flex-1 grid gap-4">
          {/* Writer Card */}
          <div className="bg-card border rounded-xl p-5  transition-colors group cursor-default">
            <div className="flex items-center gap-3 mb-3">
              <div className="size-10 rounded-xl bg-green-500/10 flex items-center justify-center  transition-colors">
                <PencilLine className="size-5 text-green-500" />
              </div>
              <div className="text-left">
                <h3 className="font-bold">Writer</h3>
                <p className="text-xs text-muted-foreground">"I own Bitcoin"</p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Generate <span className="text-foreground font-medium">high yield</span> on your BTC
              holdings by selling upside you don't think will hit.
            </p>
          </div>

          {/* Buyer Card */}
          <div className="bg-card border rounded-xl p-5  transition-colors group cursor-default">
            <div className="flex items-center gap-3 mb-3">
              <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center primary/20 transition-colors">
                <Zap className="size-5 text-primary" />
              </div>
              <div className="text-left">
                <h3 className="font-bold">Buyer</h3>
                <p className="text-xs text-muted-foreground">"I want upside"</p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Get <span className="text-foreground font-medium">up to 100x leverage</span> on price
              movements without risking liquidation. Capped downside.
            </p>
          </div>
        </div>
      </div>
    </SlideWrapper>
  );
}

// 7. Vault: Deposit
function VaultSlide() {
  return (
    <SlideWrapper>
      <div className="flex flex-col h-full items-center text-center justify-center">
        <div className="relative mb-8">
          <div className="absolute inset-0 bg-primary/10 rounded-full blur-2xl" />
          <div className="absolute  z-10 left-1/2 -translate-x-1/2 w-full  min-w-[130px] -bottom-4 bg-muted rounded-lg border shadow-sm px-3 py-1.5 flex items-center gap-2">
            <div className="size-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-xs font-mono font-medium">Self custody</span>
          </div>
          <div className="size-24 rounded-3xl bg-muted flex items-center justify-center relative z-0 border shadow-lg">
            <Lock className="size-10 text-foreground" />
          </div>
        </div>

        <h2 className="text-2xl font-bold mb-4">Fund your account</h2>

        <p className="text-muted-foreground max-w-xs mb-8">
          Deposit BTC to make offers and buy options. Withdraw anytime
        </p>

        <div className="w-full max-w-xs bg-muted rounded-xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="size-8 rounded-lg bg-background border flex items-center justify-center">
              <span className="text-xs font-bold">1</span>
            </div>
            <span className="text-sm font-medium">Deposit BTC</span>
          </div>
          <ArrowRight className="size-4 text-muted-foreground" />
          <div className="flex items-center gap-3">
            <div className="size-8 rounded-lg bg-background border flex items-center justify-center">
              <span className="text-xs font-bold">2</span>
            </div>
            <span className="text-sm font-medium">Trade</span>
          </div>
        </div>
      </div>
    </SlideWrapper>
  );
}

// 8. Ready: End
function ReadySlide() {
  return (
    <SlideWrapper>
      <div className="flex flex-col h-full items-center text-center justify-center">
        <div className="mb-8">
          <div className="size-20 rounded-full bg-green-500 flex items-center justify-center shadow-lg shadow-green-500/30">
            <CheckCircle className="size-10 text-white" />
          </div>
        </div>

        <h2 className="text-3xl font-bold mb-4">You're Ready</h2>

        <p className="text-muted-foreground max-w-xs mb-8">
          Explore the markets, check the yields, and make your first move.
        </p>
      </div>
    </SlideWrapper>
  );
}

// Wrapper for all slides
function SlideWrapper({ children }: { children: React.ReactNode }) {
  return <div className={cn("w-full h-full p-2")}>{children}</div>;
}

const SLIDES = [
  WelcomeSlide,
  ConceptSlide,
  TermStrikeSlide,
  TermAmountSlide,
  TermPremiumSlide,
  TermExpirySlide,
  MechanicsSlide,
  ScenarioITMSlide,
  ScenarioITMPayoutSlide,
  ScenarioOTMSlide,
  ScenarioOTMPayoutSlide,
  RolesSlide,
  VaultSlide,
  ReadySlide,
] as const;

const SLIDE_KEYS = [
  "welcome",
  "concept",
  "strike",
  "amount",
  "premium",
  "expiry",
  "mechanics",
  "itm",
  "itm-payout",
  "otm",
  "otm-payout",
  "roles",
  "vault",
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
    <div className="flex items-center justify-center gap-2">
      {SLIDE_KEYS.map((key, i) => (
        <button
          key={key}
          type="button"
          onClick={() => onDotClick(i)}
          className={cn(
            "transition-all duration-500 rounded-full h-1.5",
            i === current
              ? "w-8 bg-foreground"
              : "w-1.5 bg-muted-foreground/30 hover:bg-muted-foreground/50",
          )}
        />
      ))}
    </div>
  );
}

function OnboardingContent() {
  const [currentSlide, setCurrentSlide] = useState(0);
  const { completeOnboarding } = useOnboarding();

  const totalSlides = SLIDES.length;
  const isLastSlide = currentSlide === totalSlides - 1;
  const isFirstSlide = currentSlide === 0;

  const goToSlide = useCallback((index: number) => {
    setCurrentSlide(index);
  }, []);

  const nextSlide = useCallback(() => {
    if (isLastSlide) {
      completeOnboarding();
    } else {
      setCurrentSlide((prev) => prev + 1);
    }
  }, [isLastSlide, completeOnboarding]);

  const prevSlide = useCallback(() => {
    if (!isFirstSlide) {
      setCurrentSlide((prev) => prev - 1);
    }
  }, [isFirstSlide]);

  return (
    <div className="flex flex-col h-full relative">
      {/* Top Bar: Skip */}
      <div className="absolute top-0 right-0 z-10">
        {!isLastSlide && (
          <button
            type="button"
            onClick={completeOnboarding}
            className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-full hover:bg-muted/50"
          >
            Skip
          </button>
        )}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 relative mt-3 min-h-0 overflow-y-auto">
        {(() => {
          const SlideComponent = SLIDES[currentSlide];
          return <SlideComponent />;
        })()}
      </div>

      {/* Bottom Bar: Navigation & Progress */}
      <div className="pt-6 space-y-6 mt-auto shrink-0">
        <ProgressDots current={currentSlide} onDotClick={goToSlide} />

        <div className="flex gap-3">
          {!isFirstSlide && (
            <Button
              variant="outline"
              size="icon"
              onClick={prevSlide}
              className="shrink-0 rounded-full size-12"
            >
              <ArrowLeft className="size-5" />
            </Button>
          )}
          <Button
            onClick={nextSlide}
            className="flex-1 rounded-full h-12 text-base font-semibold shadow-lg shadow-primary/20"
          >
            {isLastSlide ? (
              <>
                Get Started
                <Sparkles className="size-4 ml-2" />
              </>
            ) : (
              <>
                Continue
                <ArrowRight className="size-4 ml-2" />
              </>
            )}
          </Button>
        </div>
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
        <DrawerContent className="px-4 pb-6 h-dvh! max-h-dvh! rounded-t-none!">
          <OnboardingContent />
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={showOnboarding} onOpenChange={(open) => !open && closeOnboarding()}>
      <DialogContent
        showCloseButton={false}
        className="sm:max-w-md p-5 overflow-visible min-h-[600px] border-0"
      >
        <OnboardingContent />
      </DialogContent>
    </Dialog>
  );
}

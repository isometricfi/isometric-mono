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
import { useTranslations } from "next-intl";
import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { useModal } from "@/hooks/use-modal";
import { cn } from "@/lib/utils";

// 0. Welcome: Intro
function WelcomeSlide({
  onStartTutorial,
  onSkip,
}: {
  onStartTutorial?: () => void;
  onSkip?: () => void;
} = {}) {
  const t = useTranslations("Onboarding.welcome");

  return (
    <SlideWrapper>
      <div className="flex flex-col items-center text-center h-full justify-center">
        <div className="relative mb-8">
          <div className="absolute inset-0 bg-primary/20 rounded-xl blur-3xl" />
          <div className="relative size-24 rounded-xl bg-card border shadow-xl flex items-center justify-center">
            <Image src="/logo.svg" alt="Isometric" width={64} height={64} className="w-16 h-16" />
          </div>
        </div>

        <h1 className="text-4xl font-bold mb-3 tracking-tight">{t("title")}</h1>

        <p className="text-base text-muted-foreground max-w-sm mb-8 leading-relaxed">
          {t("subtitle")}
        </p>

        <div className="w-full max-w-[280px] space-y-3 mb-8">
          <div className="flex items-center gap-3 text-sm">
            <div className="size-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Zap className="size-4 text-primary" />
            </div>
            <p className="text-left text-muted-foreground">
              <span className="font-semibold text-foreground">{t("leverage")}</span>{" "}
              {t("leverageDesc")}
            </p>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <div className="size-8 rounded-lg bg-green-500/10 flex items-center justify-center shrink-0">
              <PiggyBank className="size-4 text-green-600" />
            </div>
            <p className="text-left text-muted-foreground">
              <span className="font-semibold text-foreground">{t("earnYield")}</span>{" "}
              {t("earnYieldDesc")}
            </p>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <div className="size-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
              <Lock className="size-4 text-foreground" />
            </div>
            <p className="text-left text-muted-foreground">
              <span className="font-semibold text-foreground">{t("fullyOnChain")}</span>{" "}
              {t("fullyOnChainDesc")}
            </p>
          </div>
        </div>

        <div className="w-full  space-y-3 flex-1 flex flex-col justify-end">
          <Button
            onClick={onStartTutorial}
            className="w-full h-12 text-base font-semibold shadow-lg shadow-primary/20"
          >
            {t("startTutorial")}
            <ArrowRight className="size-4" />
          </Button>
          <Button onClick={onSkip} variant="ghost" className="w-full h-12 text-base font-medium">
            {t("skipToApp")}
          </Button>
        </div>
      </div>
    </SlideWrapper>
  );
}

// 1. Concept: The Agreement
function ConceptSlide() {
  const t = useTranslations("Onboarding.concept");

  return (
    <SlideWrapper>
      <div className="flex flex-col items-center text-center h-full justify-center">
        <div className="relative mb-10">
          <div className="absolute inset-0 bg-primary/20 rounded-full blur-3xl" />
          <div className="relative size-32 rounded-xl bg-card border shadow-xl flex items-center justify-center">
            <Handshake className="w-16 h-16 text-primary" />
          </div>
        </div>

        <h2 className="text-3xl font-bold mb-4 tracking-tight">{t("title")}</h2>

        <div className="max-w-xs space-y-6">
          <p className="text-lg text-muted-foreground leading-relaxed">
            {t("description")} <span className="text-foreground font-medium">{t("agreement")}</span>{" "}
            {t("agreementDesc")}
          </p>
          <div className="pt-5 border-t border-border/50">
            <p className="text-base font-medium text-primary">{t("keyTerms")}</p>
          </div>
        </div>
      </div>
    </SlideWrapper>
  );
}

// 2a. Term: Strike Price
function TermStrikeSlide() {
  const t = useTranslations("Onboarding.strike");

  return (
    <SlideWrapper>
      <div className="flex flex-col items-center text-center h-full ">
        <div className="relative mb-8">
          <div className="size-20 rounded-xl bg-muted border flex items-center justify-center shadow-sm">
            <Target className="size-10 text-foreground" />
          </div>
          <div className="absolute -bottom-3 -right-3 bg-background border px-2 py-1 rounded-md text-xs font-mono font-bold shadow-sm">
            $110k
          </div>
        </div>

        <h2 className="text-2xl font-bold mb-4">{t("title")}</h2>
        <p className="text-muted-foreground max-w-xs mb-8 leading-relaxed">{t("description")}</p>

        <div className="grid grid-cols-2 gap-3 w-full  text-sm">
          <div className="bg-primary/5 p-3 rounded-xl border border-primary/10 flex flex-col items-center justify-between">
            <TrendingUp className="size-6 text-primary opacity-50 " />

            <p className="  font-bold text-primary mb-1">{t("buyerWants")}</p>
            <p className=" font-medium">{t("buyerWantsDesc")}</p>
          </div>
          <div className="bg-green-500/5 p-3 rounded-xl border border-green-500/10 flex flex-col items-center justify-between">
            <TrendingDown className="size-6 text-green-600 opacity-50" />

            <p className="  font-bold text-green-600 dark:text-green-400 mb-1">
              {t("writerWants")}
            </p>
            <p className=" font-medium">{t("writerWantsDesc")}</p>
          </div>
        </div>
      </div>
    </SlideWrapper>
  );
}

// 2b. Term: Amount
function TermAmountSlide() {
  const t = useTranslations("Onboarding.amount");

  return (
    <SlideWrapper>
      <div className="flex flex-col items-center text-center h-full">
        <div className="relative mb-8">
          <div className="size-20 rounded-xl bg-muted border flex items-center justify-center shadow-sm">
            <Hash className="size-10" />
          </div>
          <div className="absolute -bottom-3 -right-3 bg-background border px-2 py-1 rounded-md text-xs font-mono font-bold shadow-sm">
            1 BTC
          </div>
        </div>

        <h2 className="text-2xl font-bold mb-4">{t("title")}</h2>
        <p className="text-muted-foreground  mb-8 leading-relaxed">{t("description")}</p>
        <div className="grid grid-cols-2 gap-3 w-full text-sm">
          <div className="bg-primary/5 p-3 rounded-xl border border-primary/10 flex flex-col items-center justify-between">
            <BatteryCharging className="size-6 text-primary opacity-50 mb-1" />
            <p className="font-bold text-primary mb-1">{t("buyer")}</p>
            <p className="font-medium">{t("buyerDesc")}</p>
          </div>
          <div className="bg-green-500/5 p-3 rounded-xl border border-green-500/10 flex flex-col items-center justify-between">
            <Lock className="size-6 text-green-600 opacity-50 mb-1" />
            <p className="font-bold text-green-600 dark:text-green-400 mb-1">{t("writer")}</p>
            <p className="font-medium">{t("writerDesc")}</p>
          </div>
        </div>
      </div>
    </SlideWrapper>
  );
}

// 2c. Term: Premium
function TermPremiumSlide() {
  const t = useTranslations("Onboarding.premium");

  return (
    <SlideWrapper>
      <div className="flex flex-col items-center text-center h-full">
        <div className="relative mb-8">
          <div className="size-20 rounded-xl bg-muted border flex items-center justify-center shadow-sm">
            <Coins className="size-10" />
          </div>
          <div className="absolute -bottom-3 -right-5 bg-background border px-2 py-1 rounded-md text-xs font-mono font-bold shadow-sm">
            0.005 BTC
          </div>
        </div>

        <h2 className="text-2xl font-bold mb-4">{t("title")}</h2>
        <p className="text-muted-foreground max-w-xs mb-8 leading-relaxed">{t("description")}</p>
        <div className="grid grid-cols-2 gap-3 w-full  text-sm">
          <div className="bg-primary/5 p-3 rounded-xl border border-primary/10 flex flex-col items-center justify-between">
            <ShoppingCart className="size-6 text-primary opacity-50 mb-1" />
            <p className="  font-bold text-primary mb-1">{t("buyer")}</p>
            <p className=" font-medium">{t("buyerDesc")}</p>
          </div>
          <div className="bg-green-500/5 p-3 rounded-xl border border-green-500/10 flex flex-col items-center justify-between">
            <PiggyBank className="size-6 text-green-600 opacity-50 mb-1" />
            <p className="  font-bold text-green-600 dark:text-green-400 mb-1">{t("writer")}</p>
            <p className=" font-medium">{t("writerDesc")}</p>
          </div>
        </div>
      </div>
    </SlideWrapper>
  );
}

// 2d. Term: Expiry
function TermExpirySlide() {
  const t = useTranslations("Onboarding.expiry");

  return (
    <SlideWrapper>
      <div className="flex flex-col items-center text-center h-full">
        <div className="relative mb-8">
          <div className="size-20 rounded-xl bg-muted border flex items-center justify-center shadow-sm">
            <Calendar className="size-10" />
          </div>
          <div className="absolute -bottom-3 -right-3 bg-background border px-2 py-1 rounded-md text-xs font-mono font-bold shadow-sm">
            {t("exampleDays")}
          </div>
        </div>

        <h2 className="text-2xl font-bold mb-4">{t("title")}</h2>
        <p className="text-muted-foreground mb-8 leading-relaxed">{t("description")}</p>
        <div className="bg-card p-3 w-full text-sm px-5 rounded-xl border border-muted-foreground/20 flex flex-col items-center justify-between">
          <Scale className="size-6 text-muted-foreground opacity-50 mb-1" />
          <p className="  font-bold  mb-1">{t("autoSettlement")}</p>
          <p className=" font-medium text-muted-foreground">{t("autoSettlementDesc")}</p>
        </div>
      </div>
    </SlideWrapper>
  );
}

// 3. Mechanics: The Exchange
function MechanicsSlide() {
  const t = useTranslations("Onboarding.mechanics");

  return (
    <SlideWrapper>
      <div className="flex flex-col h-full">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold mb-2">{t("title")}</h2>
          <p className="text-muted-foreground">{t("subtitle")}</p>
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
                  <p className="font-bold text-sm mb-0.5">{t("step1")}</p>
                  <p className="text-xs text-muted-foreground leading-snug">{t("step1Desc")}</p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="size-10 rounded-full bg-primary flex items-center justify-center shrink-0 ring-4 ring-background z-10">
                  <Zap className="size-5 text-primary-foreground" />
                </div>
                <div className="pt-1">
                  <p className="font-bold text-sm mb-0.5">{t("step2")}</p>
                  <p className="text-xs text-muted-foreground leading-snug">{t("step2Desc")}</p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="size-10 rounded-full bg-muted border flex items-center justify-center shrink-0 ring-4 ring-background z-10">
                  <Lock className="size-5 text-foreground" />
                </div>
                <div className="pt-1">
                  <p className="font-bold text-sm mb-0.5">{t("step3")}</p>
                  <p className="text-xs text-muted-foreground leading-snug">{t("step3Desc")}</p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="size-10 rounded-full bg-muted border flex items-center justify-center shrink-0 ring-4 ring-background z-10">
                  <Scale className="size-5 text-foreground" />
                </div>
                <div className="pt-1">
                  <p className="font-bold text-sm mb-0.5">{t("step4")}</p>
                  <p className="text-xs text-muted-foreground leading-snug">{t("step4Desc")}</p>
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
  const t = useTranslations("Onboarding.itm");

  return (
    <SlideWrapper>
      <div className="flex flex-col h-full">
        <div className="text-center mb-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-green-500/10 text-green-600 dark:text-green-400 rounded-md text-xs font-bold uppercase tracking-wider mb-1">
            {t("scenario")}
          </div>
          <h2 className="text-2xl font-bold mb-2">{t("title")}</h2>
          <p className="text-muted-foreground">{t("subtitle")}</p>
        </div>

        <div className="flex-1 flex flex-col justify-center gap-6">
          <div className="relative h-32 w-full bg-card border rounded-xl overflow-hidden">
            <div className="absolute top-1/2 inset-x-0 h-px bg-muted-foreground/30 border-t border-dashed" />
            <span className="absolute top-[45%] right-2 text-xs text-muted-foreground bg-muted px-1 rounded-sm">
              {t("strikeLabel")}
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
              <p className="font-bold text-sm mb-1">{t("buyerWins")}</p>
              <p className="text-xs text-muted-foreground">{t("buyerWinsDesc")}</p>
            </div>

            <div className="bg-card border rounded-xl p-4 text-center">
              <PencilLine className="size-6 text-muted-foreground mx-auto mb-2" />
              <p className="font-bold text-sm mb-1">{t("writerCaps")}</p>
              <p className="text-xs text-muted-foreground">{t("writerCapsDesc")}</p>
            </div>
          </div>
        </div>
      </div>
    </SlideWrapper>
  );
}

// 4b. Scenario: ITM Payout
function ScenarioITMPayoutSlide() {
  const t = useTranslations("Onboarding.itmPayout");

  return (
    <SlideWrapper>
      <div className="flex flex-col h-full">
        <div className="text-center mb-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-green-500/10 text-green-600 dark:text-green-400 rounded-md text-xs font-bold uppercase tracking-wider mb-1">
            {t("scenario")}
          </div>
          <h2 className="text-2xl font-bold mb-1">{t("title")}</h2>
          <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>

        <div className="flex-1 flex flex-col justify-center gap-3">
          <div className="bg-primary/5 border border-primary/20 rounded-xl p-4">
            <div className="flex items-center justify-center gap-1 mb-3">
              <Zap className="size-4 text-primary" />
              <p className="font-bold text-sm">{t("buyer")}</p>
            </div>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("premiumPaid")}</span>
                <span className="font-mono ">-0.01 BTC</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("payoutReceived")}</span>
                <span className="font-mono">+0.05 BTC</span>
              </div>
              <div className="h-px bg-border" />
              <div className="flex justify-between items-center">
                <span className="font-medium">{t("netProfit")}</span>
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
              <p className="font-bold text-sm">{t("writer")}</p>
            </div>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("collateralLocked")}</span>
                <span className="font-mono">1.00 BTC</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("premiumEarned")}</span>
                <span className="font-mono text-green-500">+0.01 BTC</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("paidToBuyer")}</span>
                <span className="font-mono text-red-500">-0.05 BTC</span>
              </div>
              <div className="h-px bg-border" />
              <div className="flex justify-between items-center">
                <span className="font-medium">{t("netResult")}</span>
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
  const t = useTranslations("Onboarding.otm");

  return (
    <SlideWrapper>
      <div className="flex flex-col h-full">
        <div className="text-center mb-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-muted text-muted-foreground rounded-md text-xs font-bold uppercase tracking-wider mb-1">
            {t("scenario")}
          </div>
          <h2 className="text-2xl font-bold mb-2">{t("title")}</h2>
          <p className="text-muted-foreground">{t("subtitle")}</p>
        </div>

        <div className="flex-1 flex flex-col justify-center gap-6">
          <div className="relative h-32 w-full bg-card border rounded-xl overflow-hidden">
            <div className="absolute top-1/2 inset-x-0 h-px bg-muted-foreground/30 border-t border-dashed" />
            <span className="absolute top-[45%] right-2 text-xs text-muted-foreground bg-muted px-1 rounded-sm">
              {t("strikeLabel")}
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
              <p className="font-bold text-sm mb-1">{t("buyerLoses")}</p>
              <p className="text-xs text-muted-foreground">{t("buyerLosesDesc")}</p>
            </div>

            <div className="bg-green-500/5 border border-green-500/20 rounded-xl p-4 text-center">
              <PencilLine className="size-6 text-green-500 mx-auto mb-2" />
              <p className="font-bold text-sm mb-1">{t("writerWins")}</p>
              <p className="text-xs text-muted-foreground">{t("writerWinsDesc")}</p>
            </div>
          </div>
        </div>
      </div>
    </SlideWrapper>
  );
}

// 5b. Scenario: OTM Payout
function ScenarioOTMPayoutSlide() {
  const t = useTranslations("Onboarding.otmPayout");

  return (
    <SlideWrapper>
      <div className="flex flex-col h-full">
        <div className="text-center mb-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-muted text-muted-foreground rounded-md text-xs font-bold uppercase tracking-wider  mb-1">
            {t("scenario")}
          </div>
          <h2 className="text-2xl font-bold mb-1">{t("title")}</h2>
          <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>

        <div className="flex-1 flex flex-col justify-center gap-3">
          <div className="bg-card border rounded-xl p-4">
            <div className="flex items-center justify-center gap-1 mb-3">
              <Zap className="size-4 text-muted-foreground" />
              <p className="font-bold text-sm">{t("buyer")}</p>
            </div>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("premiumPaid")}</span>
                <span className="font-mono text-red-500">-0.01 BTC</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("payoutReceived")}</span>
                <span className="font-mono">0.00 BTC</span>
              </div>
              <div className="h-px bg-border" />
              <div className="flex justify-between items-center">
                <span className="font-medium">{t("netLoss")}</span>
                <div className="text-right">
                  <span className="font-mono font-bold text-red-500">-0.01 BTC</span>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-green-500/5 border border-green-500/20 rounded-xl p-4">
            <div className="flex items-center justify-center gap-1 mb-3">
              <PencilLine className="size-4 text-green-500" />
              <p className="font-bold text-sm">{t("writer")}</p>
            </div>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("collateralLocked")}</span>
                <span className="font-mono">1.00 BTC</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("premiumEarned")}</span>
                <span className="font-mono text-green-500">+0.01 BTC</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("paidToBuyer")}</span>
                <span className="font-mono">0.00 BTC</span>
              </div>
              <div className="h-px bg-border" />
              <div className="flex justify-between items-center">
                <span className="font-medium">{t("returned")}</span>
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

// 7. Vault: Deposit
function VaultSlide() {
  const t = useTranslations("Onboarding.vault");

  return (
    <SlideWrapper>
      <div className="flex flex-col h-full items-center text-center justify-center">
        <div className="relative mb-8">
          <div className="absolute inset-0 bg-primary/10 rounded-full blur-2xl" />
          <div className="absolute  z-10 left-1/2 -translate-x-1/2 w-full  min-w-[130px] -bottom-4 bg-muted rounded-lg border shadow-sm px-3 py-1.5 flex items-center gap-2">
            <div className="size-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-xs font-mono font-medium">{t("selfCustody")}</span>
          </div>
          <div className="size-24 rounded-xl bg-muted flex items-center justify-center relative z-0 border shadow-lg">
            <Lock className="size-10 text-foreground" />
          </div>
        </div>

        <h2 className="text-2xl font-bold mb-4">{t("title")}</h2>

        <p className="text-muted-foreground max-w-xs mb-8">{t("description")}</p>

        <div className="w-full max-w-xs bg-muted rounded-xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="size-8 rounded-lg bg-background border flex items-center justify-center">
              <span className="text-xs font-bold">1</span>
            </div>
            <span className="text-sm font-medium">{t("step1")}</span>
          </div>
          <ArrowRight className="size-4 text-muted-foreground" />
          <div className="flex items-center gap-3">
            <div className="size-8 rounded-lg bg-background border flex items-center justify-center">
              <span className="text-xs font-bold">2</span>
            </div>
            <span className="text-sm font-medium">{t("step2")}</span>
          </div>
        </div>
      </div>
    </SlideWrapper>
  );
}

// 8. Ready: End
function ReadySlide() {
  const t = useTranslations("Onboarding.ready");

  return (
    <SlideWrapper>
      <div className="flex flex-col h-full items-center text-center justify-center">
        <div className="mb-8">
          <div className="size-20 rounded-full bg-green-500 flex items-center justify-center shadow-lg shadow-green-500/30">
            <CheckCircle className="size-10 text-white" />
          </div>
        </div>

        <h2 className="text-3xl font-bold mb-4">{t("title")}</h2>

        <p className="text-muted-foreground max-w-xs mb-8">{t("description")}</p>
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
            "transition-all duration-500 rounded-sm h-1.5",
            i === current
              ? "w-8 bg-foreground"
              : "w-1.5 bg-muted-foreground/30 hover:bg-muted-foreground/50",
          )}
        />
      ))}
    </div>
  );
}

export function OnboardingContent() {
  const t = useTranslations("Onboarding.navigation");
  const [currentSlide, setCurrentSlide] = useState(0);
  const { closeModal } = useModal();

  const totalSlides = SLIDES.length;
  const isLastSlide = currentSlide === totalSlides - 1;
  const isFirstSlide = currentSlide === 0;

  const goToSlide = useCallback((index: number) => {
    setCurrentSlide(index);
  }, []);

  const nextSlide = useCallback(() => {
    if (isLastSlide) {
      closeModal();
    } else {
      setCurrentSlide((prev) => prev + 1);
    }
  }, [isLastSlide, closeModal]);

  const prevSlide = useCallback(() => {
    if (!isFirstSlide) {
      setCurrentSlide((prev) => prev - 1);
    }
  }, [isFirstSlide]);

  return (
    <div className="flex flex-col h-full relative">
      {/* Top Bar: Skip */}
      <div className="absolute top-0 right-0 z-10">
        {!isLastSlide && !isFirstSlide && (
          <button
            type="button"
            onClick={closeModal}
            className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-md hover:bg-muted/50"
          >
            {t("skip")}
          </button>
        )}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 relative mt-3 min-h-0 overflow-y-auto">
        {(() => {
          const SlideComponent = SLIDES[currentSlide];
          if (currentSlide === 0) {
            return <SlideComponent onStartTutorial={nextSlide} onSkip={closeModal} />;
          }
          return <SlideComponent />;
        })()}
      </div>

      {/* Bottom Bar: Navigation & Progress */}
      {!isFirstSlide && (
        <div className="pt-6 space-y-6 mt-auto shrink-0">
          <ProgressDots current={currentSlide} onDotClick={goToSlide} />

          <div className="flex gap-3">
            <Button variant="outline" size="icon" onClick={prevSlide} className="shrink-0 size-12">
              <ArrowLeft className="size-5" />
            </Button>
            <Button
              onClick={nextSlide}
              className="flex-1 h-12 text-base font-semibold shadow-lg shadow-primary/20"
            >
              {isLastSlide ? (
                <>
                  {t("getStarted")}
                  <Sparkles className="size-4" />
                </>
              ) : (
                <>
                  {t("continue")}
                  <ArrowRight className="size-4" />
                </>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export function openOnboardingModal() {
  useModal.getState().openModal(<OnboardingContent />, false, "600px");
}

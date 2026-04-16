"use client";

import { motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Book,
  CircleDollarSign,
  Lock,
  PiggyBank,
  Rocket,
  Sparkles,
  TrendingUp,
  Zap,
} from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { SlidingNumber } from "@/components/ui/sliding-number";
import { useModal } from "@/hooks/use-modal";
import { RESOURCE_LINKS, SOCIAL_LINKS, XIcon } from "@/lib/site-links";
import { cn } from "@/lib/utils";

function WelcomeSlide() {
  const t = useTranslations("Onboarding.welcome");

  return (
    <SlideWrapper>
      <div className="flex flex-col items-center text-center h-full justify-center">
        <div className="relative mb-5">
          <div className="relative size-20 rounded-xl bg-card border shadow-xl flex items-center justify-center">
            <Image src="/logo.svg" alt="Isometric" width={56} height={56} className="w-14 h-14" />
          </div>
        </div>

        <h1 className="text-4xl font-bold mb-2 tracking-tight">{t("title")}</h1>
        <p className="text-base text-muted-foreground max-w-xs mb-5 leading-relaxed">
          {t("tagline")}
        </p>

        <div className="w-full max-w-[280px] space-y-3 mb-4">
          <motion.div
            className="flex items-center gap-3 text-sm"
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
          >
            <div className="size-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Zap className="size-4 text-primary" />
            </div>
            <p className="text-left text-foreground font-medium">{t("benefit1")}</p>
          </motion.div>
          <motion.div
            className="flex items-center gap-3 text-sm"
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
          >
            <div className="size-8 rounded-lg bg-green-500/10 flex items-center justify-center shrink-0">
              <PiggyBank className="size-4 text-green-600" />
            </div>
            <p className="text-left text-foreground font-medium">{t("benefit2")}</p>
          </motion.div>
          <motion.div
            className="flex items-center gap-3 text-sm"
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
          >
            <div className="size-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
              <Lock className="size-4 text-foreground" />
            </div>
            <p className="text-left text-foreground font-medium">{t("benefit3")}</p>
          </motion.div>
        </div>

        <div className="w-full flex-1 flex flex-col justify-end"></div>
      </div>
    </SlideWrapper>
  );
}

function StrategiesSlide() {
  const t = useTranslations("Onboarding.strategies");

  return (
    <SlideWrapper>
      <div className="flex flex-col h-full">
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold tracking-tight">{t("title")}</h2>
        </div>

        <div className="flex flex-col gap-3 flex-1">
          <motion.div
            className="bg-primary/5 border border-primary/20 rounded-xl p-4 space-y-3"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <div className="flex gap-4 items-center ">
              <div className="size-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <TrendingUp className="size-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-base mb-0.5">{t("predictTitle")}</p>
                <p className="text-xs text-muted-foreground leading-relaxed">{t("predictDesc")}</p>
              </div>
            </div>
            <div className="justify-center flex items-center gap-1 bg-primary/10 text-primary rounded-md px-2 py-1 text-xs font-bold w-full">
              <Zap className="size-3" />
              {t("predictBadge")}
            </div>
          </motion.div>

          <motion.div
            className="bg-green-500/5 border border-green-500/20 rounded-xl p-4 space-y-3"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <div className="flex gap-4 items-center ">
              <div className="size-10 rounded-lg bg-green-500/10 flex items-center justify-center shrink-0">
                <PiggyBank className="size-5 text-green-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-base mb-0.5">{t("earnTitle")}</p>
                <p className="text-xs text-muted-foreground leading-relaxed">{t("earnDesc")}</p>
              </div>
            </div>
            <div className="flex justify-center items-center gap-1 bg-green-500/10 text-green-600 dark:text-green-400 rounded-md px-2 py-1 text-xs font-bold shrink-0">
              <CircleDollarSign className="size-3" />
              {t("earnBadge")}
            </div>
          </motion.div>
        </div>
      </div>
    </SlideWrapper>
  );
}

// At $120k settlement with $105k strike, notional sized so payout = 0.05 BTC → net = +0.04 BTC = +400%
// notional = 0.05 * 105000 / (120000 - 105000) = 0.35 BTC
const BUYING_STRIKE = 105000;
const BUYING_TARGET = 120000;
const BUYING_NOTIONAL = 0.35;
const BUYING_PREMIUM = 0.01;

function BuyingSlide() {
  const t = useTranslations("Onboarding.buying");
  const [price, setPrice] = useState(BUYING_STRIKE);

  useEffect(() => {
    const STEPS = 80;
    const STEP_MS = 40;
    let step = 0;
    let interval: ReturnType<typeof setInterval>;

    const delay = setTimeout(() => {
      interval = setInterval(() => {
        step++;
        const progress = step / STEPS;
        setPrice(Math.round(BUYING_STRIKE + (BUYING_TARGET - BUYING_STRIKE) * progress));
        if (step >= STEPS) clearInterval(interval);
      }, STEP_MS);
    }, 150);

    return () => {
      clearTimeout(delay);
      clearInterval(interval);
    };
  }, []);

  const payout = Math.max(0, ((price - BUYING_STRIKE) / BUYING_STRIKE) * BUYING_NOTIONAL);
  const netBtc = Math.max(0, Math.round((payout - BUYING_PREMIUM) * 100) / 100);
  const netPct = Math.max(0, Math.round((netBtc / BUYING_PREMIUM) * 100));
  const isITM = price > BUYING_STRIKE;

  return (
    <SlideWrapper>
      <div className="flex flex-col h-full">
        <div className="text-center mb-5">
          <h2 className="text-2xl font-bold tracking-tight">{t("title")}</h2>
        </div>

        <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 mb-4">
          <div className="space-y-2.5 text-sm">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">{t("youPutIn")}</span>
              <span className="font-mono font-semibold">0.01 BTC</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">{t("yourBet")}</span>
              <span className="font-semibold text-xs">{t("betValue")}</span>
            </div>
            <div className="h-px bg-border" />
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground flex items-center gap-1.5">
                {t("btcPrice")}
                <motion.span
                  animate={{ opacity: isITM ? 1 : 0.3 }}
                  className="text-green-500 font-bold leading-none"
                >
                  ↑
                </motion.span>
              </span>
              <span
                className={cn(
                  "font-mono font-semibold flex items-center",
                  isITM ? "text-green-500" : "text-foreground",
                )}
              >
                $<SlidingNumber value={price} />
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="font-medium">{t("netGain")}</span>
              <div className="flex items-baseline gap-2">
                <span className="font-mono font-bold flex items-center text-foreground">
                  +0.
                  <SlidingNumber value={Math.round(netBtc * 100)} padStart /> BTC
                </span>
                <span
                  className={cn(
                    "text-2xl font-black flex items-center tabular-nums",
                    isITM ? "text-green-500" : "text-muted-foreground",
                  )}
                >
                  +<SlidingNumber value={netPct} />%
                </span>
              </div>
            </div>
          </div>
        </div>

        <motion.div
          className="bg-muted/60 border rounded-xl p-4 text-center"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <p className="md:text-sm text-xs font-semibold text-foreground">{t("keyFact")}</p>
        </motion.div>
      </div>
    </SlideWrapper>
  );
}

function WritingSlide() {
  const t = useTranslations("Onboarding.writing");

  return (
    <SlideWrapper>
      <div className="flex flex-col h-full">
        <div className="text-center mb-5">
          <h2 className="text-2xl font-bold tracking-tight">{t("title")}</h2>
        </div>

        <div className="bg-green-500/5 border border-green-500/20 rounded-xl p-4 mb-4">
          <div className="space-y-2.5 text-sm">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">{t("youLock")}</span>
              <span className="font-mono font-semibold">1 BTC for 7 days</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">{t("youEarnUpfront")}</span>
              <span className="font-mono font-semibold text-green-500">+0.01 BTC</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">{t("condition")}</span>
              <span className="font-mono font-semibold text-xs">{t("conditionValue")}</span>
            </div>
            <div className="h-px bg-border" />
            <div className="flex justify-between items-center">
              <span className="font-medium">{t("netReturn")}</span>
              <div className="flex items-baseline gap-2">
                <span className="font-mono font-bold">1.01 BTC</span>
                <motion.span
                  className="text-2xl font-black text-green-500 tabular-nums"
                  initial={{ opacity: 0, scale: 0.7 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.3, type: "spring", stiffness: 200 }}
                >
                  68% APY
                </motion.span>
              </div>
            </div>
          </div>
        </div>

        <motion.div
          className="bg-muted/60 border rounded-xl p-4 text-center"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <p className="md:text-sm text-xs font-semibold text-foreground">{t("keyFact")}</p>
        </motion.div>
      </div>
    </SlideWrapper>
  );
}

function ReadySlide() {
  const t = useTranslations("Onboarding.ready");

  return (
    <SlideWrapper>
      <div className="flex flex-col h-full items-center text-center justify-center">
        <motion.div
          className="mb-8"
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 15 }}
        >
          <div className="size-20 rounded-full bg-primary flex items-center justify-center shadow-lg shadow-primary/30">
            <Rocket className="size-10 text-primary-foreground" />
          </div>
        </motion.div>

        <h2 className="text-3xl font-bold mb-6 tracking-tight">{t("title")}</h2>

        <div className="w-full max-w-xs space-y-3">
          <div className="flex items-center gap-3 bg-muted/40 border border-border/50 rounded-xl px-4 py-3">
            <span className="size-6 rounded-full bg-muted-foreground/20 text-muted-foreground text-xs font-bold flex items-center justify-center shrink-0">
              1
            </span>
            <span className="text-sm font-medium">{t("step1")}</span>
          </div>
          <div className="flex items-center gap-3 bg-muted/40 border border-border/50 rounded-xl px-4 py-3">
            <span className="size-6 rounded-full bg-muted-foreground/20 text-muted-foreground text-xs font-bold flex items-center justify-center shrink-0">
              2
            </span>
            <span className="text-sm font-medium">{t("step2")}</span>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-1">
            <a
              href={SOCIAL_LINKS.x}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2.5 border border-border/50 rounded-xl px-4 py-3 text-sm font-medium text-muted-foreground hover:text-foreground hover:border-border transition-colors"
            >
              <XIcon className="size-4 shrink-0" />
              {t("linkX")}
            </a>
            <a
              href={RESOURCE_LINKS.docs}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2.5 border border-border/50 rounded-xl px-4 py-3 text-sm font-medium text-muted-foreground hover:text-foreground hover:border-border transition-colors"
            >
              <Book className="size-4 shrink-0" />
              {t("linkDocs")}
            </a>
          </div>
        </div>
      </div>
    </SlideWrapper>
  );
}

function SlideWrapper({ children }: { children: React.ReactNode }) {
  return <div className={cn("w-full h-full p-2")}>{children}</div>;
}

const SLIDES = [WelcomeSlide, StrategiesSlide, BuyingSlide, WritingSlide, ReadySlide] as const;

const SLIDE_KEYS = ["welcome", "strategies", "buying", "writing", "ready"] as const;

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
      <div className="absolute top-0 right-0 z-10">
        {!isLastSlide && (
          <button
            type="button"
            onClick={closeModal}
            className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-md hover:bg-muted/50"
          >
            {t("skip")}
          </button>
        )}
      </div>

      <div className="flex-1 relative mt-3 min-h-0 overflow-y-auto">
        <motion.div
          key={currentSlide}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="h-full"
        >
          {(() => {
            const SlideComponent = SLIDES[currentSlide];
            return <SlideComponent />;
          })()}
        </motion.div>
      </div>

      <div className="pt-6 space-y-6 mt-auto shrink-0">
        <ProgressDots current={currentSlide} onDotClick={goToSlide} />

        <div className="flex gap-3">
          {!isFirstSlide && (
            <Button variant="outline" size="icon" onClick={prevSlide} className="shrink-0 size-12">
              <ArrowLeft className="size-5" />
            </Button>
          )}
          <Button
            onClick={nextSlide}
            className="flex-1 h-12 text-base font-semibold shadow-lg shadow-primary/20"
          >
            {isFirstSlide ? (
              <>
                {t("showMe")}
                <ArrowRight className="size-4" />
              </>
            ) : isLastSlide ? (
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
    </div>
  );
}

export function openOnboardingModal() {
  useModal.getState().openModal(<OnboardingContent />, false, "600px");
}

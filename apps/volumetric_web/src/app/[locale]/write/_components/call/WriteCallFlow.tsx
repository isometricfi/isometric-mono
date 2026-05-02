"use client";

import { useDynamicContext } from "@dynamic-labs/sdk-react-core";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useMediaQuery } from "react-responsive";
import { BTCPriceChart } from "@/components/options/BTCPriceChart";
import {
  MobileAmountInput,
  MobileAmountInputSkeleton,
} from "@/components/options/MobileAmountInput";
import {
  FlowInfoPanel,
  FlowOfferStatus,
  FlowScenariosCard,
  FlowStepHeading,
  FlowStepperPicker,
  FlowSummaryCard,
  FlowTermGrid,
  highlightTags,
  type Scenario,
  type SummaryRow,
} from "@/components/options/MobileFlowParts";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { DockSlider } from "@/components/ui/dock-slider";
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from "@/components/ui/drawer";
import { ProgressDots } from "@/components/ui/progress-dots";
import { Skeleton } from "@/components/ui/skeleton";
import { SlideToConfirm } from "@/components/ui/slide-to-confirm";
import { useConfig } from "@/hooks";
import { Link } from "@/i18n/routing";
import { getNiceErrorMessage } from "@/lib/error-message";
import { basisPointsToPercent, formatBtc, roundToN, satsToBtc } from "@/lib/utils";
import { useCallWriteOptionFormModel } from "./_internal/use-call-write-option-form-model";

interface WriteCallFlowProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRequestDeposit: () => void;
}

const STEPS = ["termStrike", "collateral", "premium", "review"] as const;
type StepName = (typeof STEPS)[number];

type WriteModel = ReturnType<typeof useCallWriteOptionFormModel>;

export function WriteCallFlow({ open, onOpenChange, onRequestDeposit }: WriteCallFlowProps) {
  const isMobile = useMediaQuery({ query: "(max-width: 768px)" });
  const t = useTranslations("WriteFlow");
  const tCommon = useTranslations("Common");
  const tOfferResult = useTranslations("OfferResult");
  const [stepIndex, setStepIndex] = useState(0);
  const { primaryWallet, setShowAuthFlow } = useDynamicContext();
  const { data: config } = useConfig();
  const model = useCallWriteOptionFormModel();

  const step: StepName = STEPS[stepIndex];
  const isFirstStep = stepIndex === 0;
  const isReview = step === "review";
  const offerStep = model.acceptOffer.step;
  const isOfferProcessing = offerStep === "signing" || offerStep === "submitting";
  const isOfferSuccess = offerStep === "success";
  const isOfferError = offerStep === "error";
  const isOfferActive = isOfferProcessing || isOfferSuccess || isOfferError;

  const apyPercent = roundToN(
    model.amountSats > 0 && model.selectedTermDay > 0
      ? (model.earningsSats / model.amountSats) * (365 / model.selectedTermDay) * 100
      : 0,
    0,
  );

  const goBack = () => setStepIndex((i) => Math.max(0, i - 1));
  const goNext = () => setStepIndex((i) => Math.min(STEPS.length - 1, i + 1));

  const canAdvance =
    step === "collateral"
      ? !model.isBalanceLoading &&
        model.amountSats >= model.minCreateOfferAmountSats &&
        model.amountSats <= model.maxCreateOfferAmountSats
      : true;

  const handleSlideConfirm = () => {
    if (!primaryWallet) {
      setShowAuthFlow(true);
      return;
    }
    if (model.needDepositMore) {
      onRequestDeposit();
      return;
    }
    model.handleSubmit();
  };

  const closeFlow = () => {
    model.handleModalClose(false);
    setStepIndex(0);
    onOpenChange(false);
  };

  const tryAgain = () => {
    model.handleModalClose(false);
  };

  const handleContainerOpenChange = (next: boolean) => {
    if (!next && isOfferProcessing) return;
    if (!next) closeFlow();
    else onOpenChange(next);
  };

  const body = (
    <>
      <div className="flex-1 overflow-y-auto overflow-x-hidden flex flex-col">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={isReview && isOfferActive ? `review-${offerStep}` : step}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="px-5 py-4 flex-1 flex flex-col"
          >
            {step === "termStrike" && <TermStrikeStep model={model} />}
            {step === "collateral" && (
              <CollateralStep model={model} onDepositClick={onRequestDeposit} />
            )}
            {step === "premium" && <PremiumStep model={model} apy={apyPercent} />}
            {step === "review" &&
              (isOfferActive ? (
                <FlowOfferStatus
                  type="create"
                  step={offerStep}
                  errorMessage={getNiceErrorMessage(model.acceptOffer.error) ?? undefined}
                />
              ) : (
                <ReviewStep
                  model={model}
                  apy={apyPercent}
                  feePercent={basisPointsToPercent(
                    Number(config?.fees.premiumFeeBasisPoints ?? BigInt(0)),
                  )}
                />
              ))}
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="pt-6 pb-6 px-5 space-y-6 mt-auto shrink-0">
        <ProgressDots
          keys={STEPS}
          current={stepIndex}
          onDotClick={(i) => i < stepIndex && !isOfferActive && setStepIndex(i)}
          isClickable={(i) => i < stepIndex && !isOfferActive}
        />

        <div className="flex gap-3">
          {!isFirstStep && !isOfferActive && (
            <Button variant="outline" size="xl" onClick={goBack} className="w-12">
              <ArrowLeft className="size-5" />
            </Button>
          )}
          {isReview && isOfferSuccess ? (
            <>
              <Button asChild className="flex-1" size="xl">
                <Link href="/portfolio" onClick={closeFlow}>
                  {tOfferResult("viewPortfolio")}
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button variant="outline" className="flex-1" size="xl" onClick={closeFlow}>
                {tCommon("close")}
              </Button>
            </>
          ) : isReview && isOfferError ? (
            <>
              <Button variant="outline" className="flex-1" size="xl" onClick={closeFlow}>
                {tCommon("close")}
              </Button>
              <Button className="flex-1" size="xl" onClick={tryAgain}>
                {tCommon("tryAgain")}
              </Button>
            </>
          ) : isReview ? (
            <div className="flex-1">
              <SlideToConfirm
                label={model.getButtonText()}
                disabled={!!primaryWallet && !model.needDepositMore && model.isSubmitDisabled}
                isProcessing={isOfferProcessing}
                onConfirm={handleSlideConfirm}
              />
            </div>
          ) : (
            <Button onClick={goNext} disabled={!canAdvance} className="flex-1" size="xl">
              {t("continue")}
            </Button>
          )}
        </div>
      </div>
    </>
  );

  return (
    <>
      {isMobile ? (
        <Drawer open={open} onOpenChange={handleContainerOpenChange}>
          <DrawerContent className="min-h-[98vh] p-0 flex flex-col">
            <DrawerTitle className="sr-only">{t("title")}</DrawerTitle>
            <DrawerDescription className="sr-only">{t("description")}</DrawerDescription>
            {body}
          </DrawerContent>
        </Drawer>
      ) : (
        <Dialog open={open} onOpenChange={handleContainerOpenChange}>
          <DialogContent
            showCloseButton={false}
            className="sm:max-w-md p-0 gap-0 min-h-[630px] max-h-[630px] flex flex-col overflow-hidden"
          >
            <DialogTitle className="sr-only">{t("title")}</DialogTitle>
            {body}
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

function TermStrikeStep({ model }: { model: WriteModel }) {
  const t = useTranslations("WriteFlow");
  const index = model.strikeUsdValues.indexOf(model.selectedStrikeUsd);
  const canPrev = index > 0;
  const canNext = index >= 0 && index < model.strikeUsdValues.length - 1;

  return (
    <>
      <FlowStepHeading
        eyebrow={t("termStrike.stepLabel")}
        title={t.rich("termStrike.title", highlightTags)}
      />
      <div className="mb-5 -mt-3">
        <BTCPriceChart mode="writer" compact />
      </div>
      <div className="mb-5">
        <FlowTermGrid
          termDays={model.termDays}
          selectedTerm={model.selectedTermDay}
          onSelect={model.setTerm}
        />
      </div>
      <FlowStepperPicker
        value={`$${model.selectedStrikeUsd.toLocaleString()}`}
        caption={t("termStrike.percentAbove", {
          percent: model.selectedStrikePercent,
        })}
        canPrev={canPrev}
        canNext={canNext}
        onPrev={() => canPrev && model.handleStrikeUsdChange(model.strikeUsdValues[index - 1])}
        onNext={() => canNext && model.handleStrikeUsdChange(model.strikeUsdValues[index + 1])}
      />
      <div className="mt-6">
        <FlowInfoPanel>{t("termStrike.explain")}</FlowInfoPanel>
      </div>
    </>
  );
}

function CollateralStep({
  model,
  onDepositClick,
}: {
  model: WriteModel;
  onDepositClick: () => void;
}) {
  const t = useTranslations("WriteFlow");
  const tForms = useTranslations("Forms");
  return (
    <>
      <FlowStepHeading
        eyebrow={t("collateral.stepLabel")}
        title={t.rich("collateral.title", highlightTags)}
      />
      {model.isBalanceLoading ? (
        <>
          <MobileAmountInputSkeleton />
          <div className="mt-6">
            <Skeleton className="h-8 w-full rounded-md" />
          </div>
        </>
      ) : (
        <>
          <MobileAmountInput
            eyebrow={tForms("collateral")}
            amountSats={model.amountSats}
            btcPrice={model.btcPrice}
            maxAmountSats={model.maxCreateOfferAmountSats}
            minAmountSats={model.minCreateOfferAmountSats}
            availableBalanceSats={model.availableBalanceSats}
            onAmountSatsChange={model.handleAmountSatsChange}
            onDepositClick={onDepositClick}
          />
          <div className="mt-6">
            <FlowInfoPanel>{t("collateral.explain")}</FlowInfoPanel>
          </div>
        </>
      )}
    </>
  );
}

function PremiumStep({ model, apy }: { model: WriteModel; apy: number }) {
  const t = useTranslations("WriteFlow");
  const { rank, totalOffers, bestPremiumPercent, isLargestAtPremium } = model.competitiveness;
  const isBest = rank === 1;
  const isTiedAtBest = !isBest && bestPremiumPercent === model.premiumPercent;
  const showLargestBadge = !isBest && isLargestAtPremium && model.amountSats > 0;

  const bestIdx =
    bestPremiumPercent === null ? -1 : model.premiumValues.indexOf(bestPremiumPercent);
  const canUndercutBest = bestIdx > 0 || (bestIdx === 0 && !isTiedAtBest);

  const handleUndercutBest = () => {
    if (!canUndercutBest) return;
    const target = bestIdx === 0 ? model.premiumValues[0] : model.premiumValues[bestIdx - 1];
    model.handlePremiumPercentChange(target);
  };
  const earningsBtc = satsToBtc(model.earningsSats);
  const earningsUsd = Math.round(earningsBtc * model.btcPrice);

  return (
    <>
      <FlowStepHeading
        eyebrow={t("premium.stepLabel")}
        title={t.rich("premium.title", highlightTags)}
      />
      <div className="flex flex-col items-center">
        <p className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground font-medium mb-1">
          {t("premium.eyebrow")}
        </p>
        <p className="text-[40px] leading-none font-bold tabular-nums">{model.premiumPercent}%</p>
        <p className="text-sm text-muted-foreground tabular-nums mt-1.5">
          <span className="text-foreground/80">{t("premium.apy", { apy })}</span>
          <span className="text-muted-foreground/60">
            {" · ₿"}
            {earningsBtc.toFixed(6)}
            {" · $"}
            {earningsUsd.toLocaleString()}
          </span>
        </p>
        <div className="mt-3 flex items-center gap-2 flex-wrap justify-center">
          {isBest ? (
            <div className="px-3 py-1 rounded-full text-xs font-semibold border tabular-nums text-primary border-primary/40 bg-primary/10">
              {t("premium.bestOffer")}
            </div>
          ) : canUndercutBest ? (
            <button
              type="button"
              onClick={handleUndercutBest}
              className="px-3 py-1 rounded-full text-xs font-semibold border tabular-nums text-muted-foreground border-border bg-muted/30 hover:text-foreground hover:bg-muted/60 transition-colors cursor-pointer"
            >
              {isTiedAtBest
                ? t("premium.tiedRank", { rank, total: totalOffers })
                : t("premium.underBest", { best: bestPremiumPercent ?? 0 })}
            </button>
          ) : (
            <div className="px-3 py-1 rounded-full text-xs font-semibold border tabular-nums text-muted-foreground border-border bg-muted/30">
              {t("premium.tiedRank", { rank, total: totalOffers })}
            </div>
          )}
          {showLargestBadge && (
            <div className="px-3 py-1 rounded-full text-xs font-semibold border text-primary border-primary/40 bg-primary/10">
              {t("premium.largest")}
            </div>
          )}
        </div>
        <div className="w-full mt-4 rounded-xl border bg-muted/20 ">
          <DockSlider
            values={model.premiumValues}
            value={model.premiumPercent}
            onChange={model.handlePremiumPercentChange}
            renderLabel={(v, active) => (
              <span className={active ? "text-foreground" : "text-muted-foreground"}>{v}</span>
            )}
          />
        </div>
      </div>
      <div className="mt-6">
        <FlowInfoPanel>{t("premium.explain")}</FlowInfoPanel>
      </div>
    </>
  );
}

function ReviewStep({
  model,
  apy,
  feePercent,
}: {
  model: WriteModel;
  apy: number;
  feePercent: number;
}) {
  const t = useTranslations("WriteFlow");
  const tForms = useTranslations("Forms");
  const tSummary = useTranslations("Summary");
  const termLabel = tForms(model.selectedTermDay === 1 ? "day" : "days").toLowerCase();
  const earningsBtc = satsToBtc(model.earningsSats);
  const earningsUsd = Math.round(earningsBtc * model.btcPrice);
  const strikeDisplay = `$${model.selectedStrikeUsd.toLocaleString()}`;

  const rows: SummaryRow[] = [
    { label: t("review.strike"), value: strikeDisplay },
    { label: t("review.term"), value: `${model.selectedTermDay} ${termLabel}` },
    {
      label: t("review.collateral"),
      value: `₿${formatBtc(model.amountSats, 6)}`,
    },
    {
      label: t("review.earnings"),
      value: `₿${earningsBtc.toFixed(6)} · $${earningsUsd.toLocaleString()}`,
      accent: true,
    },
    { label: t("review.apy"), value: `${apy}%` },
    {
      label: t("review.platformFee"),
      value: tSummary("writeExplainer.platformFeeDesc", { fee: feePercent }),
    },
  ];

  const scenarios: Scenario[] = [
    {
      condition: tSummary("writeExplainer.ifBelow", { strike: strikeDisplay }),
      outcome: tSummary("writeExplainer.ifBelowDesc"),
    },
    {
      condition: tSummary("writeExplainer.ifRises", { strike: strikeDisplay }),
      outcome: tSummary("writeExplainer.ifRisesDesc"),
    },
  ];

  return (
    <>
      <FlowStepHeading
        eyebrow={t("review.stepLabel")}
        title={t.rich("review.title", highlightTags)}
      />
      <FlowSummaryCard rows={rows} />
      <div className="mt-3">
        <FlowScenariosCard scenarios={scenarios} />
      </div>
    </>
  );
}

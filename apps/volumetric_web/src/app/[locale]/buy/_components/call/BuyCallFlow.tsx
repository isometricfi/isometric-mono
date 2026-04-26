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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from "@/components/ui/drawer";
import { ProgressDots } from "@/components/ui/progress-dots";
import { Skeleton } from "@/components/ui/skeleton";
import { SlideToConfirm } from "@/components/ui/slide-to-confirm";
import { useConfig } from "@/hooks";
import { Link } from "@/i18n/routing";
import { basisPointsToPercent, cn, formatBtc, roundToN, satsToBtc } from "@/lib/utils";
import { useCallOptionBuyFormModel } from "./_internal/use-call-option-buy-form-model";

interface BuyCallFlowProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRequestDeposit: () => void;
}

const STEPS = ["termStrike", "amount", "review"] as const;
type StepName = (typeof STEPS)[number];

type BuyModel = ReturnType<typeof useCallOptionBuyFormModel>;

export function BuyCallFlow({ open, onOpenChange, onRequestDeposit }: BuyCallFlowProps) {
  const isMobile = useMediaQuery({ query: "(max-width: 768px)" });
  const t = useTranslations("BuyFlow");
  const tCommon = useTranslations("Common");
  const tOfferResult = useTranslations("OfferResult");
  const [stepIndex, setStepIndex] = useState(0);
  const { primaryWallet, setShowAuthFlow } = useDynamicContext();
  const { data: config } = useConfig();
  const model = useCallOptionBuyFormModel();

  const step: StepName = STEPS[stepIndex];
  const isFirstStep = stepIndex === 0;
  const isReview = step === "review";
  const offerStep = model.acceptOffer.step;
  const isOfferProcessing = offerStep === "signing" || offerStep === "submitting";
  const isOfferSuccess = offerStep === "success";
  const isOfferError = offerStep === "error";
  const isOfferActive = isOfferProcessing || isOfferSuccess || isOfferError;

  const goBack = () => setStepIndex((i) => Math.max(0, i - 1));
  const goNext = () => setStepIndex((i) => Math.min(STEPS.length - 1, i + 1));

  const canAdvance =
    step === "amount"
      ? !model.isBalanceLoading && model.amountSats > 0
      : step === "termStrike"
        ? model.strikeUsdValues.length > 0
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
            {step === "amount" && <AmountStep model={model} onDepositClick={onRequestDeposit} />}
            {step === "review" &&
              (isOfferActive ? (
                <FlowOfferStatus
                  type="buy"
                  step={offerStep}
                  errorMessage={model.acceptOffer.error?.message}
                />
              ) : (
                <ReviewStep
                  model={model}
                  feePercent={basisPointsToPercent(
                    Number(config?.fees.profitFeeBasisPoints ?? BigInt(0)),
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
            <Button variant="outline" onClick={goBack} className="shrink-0 w-12" size={"xl"}>
              <ArrowLeft className="size-5" />
            </Button>
          )}
          {isReview && isOfferSuccess ? (
            <>
              <Button asChild className="flex-1" size={"xl"}>
                <Link href="/portfolio" onClick={closeFlow}>
                  {tOfferResult("viewPortfolio")}
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button variant="outline" className="flex-1" size={"xl"} onClick={closeFlow}>
                {tOfferResult("buyAnother")}
              </Button>
            </>
          ) : isReview && isOfferError ? (
            <>
              <Button variant="outline" className="flex-1" size={"xl"} onClick={closeFlow}>
                {tCommon("close")}
              </Button>
              <Button className="flex-1" size={"xl"} onClick={tryAgain}>
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
            <Button onClick={goNext} disabled={!canAdvance} size="xl" className="flex-1">
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
          <DrawerContent className="h-[95dvh] p-0 flex flex-col">
            <DrawerTitle className="sr-only">{t("title")}</DrawerTitle>
            <DrawerDescription className="sr-only">{t("description")}</DrawerDescription>
            {body}
          </DrawerContent>
        </Drawer>
      ) : (
        <Dialog open={open} onOpenChange={handleContainerOpenChange}>
          <DialogContent
            showCloseButton={false}
            className="sm:max-w-[500px] p-0 gap-0 min-h-[630px] max-h-[630px] flex flex-col overflow-hidden"
          >
            <DialogTitle className="sr-only">{t("title")}</DialogTitle>
            {body}
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

function TermStrikeStep({ model }: { model: BuyModel }) {
  const t = useTranslations("BuyFlow");
  const index = model.strikeUsdValues.indexOf(model.selectedStrikeUsd);
  const canPrev = index > 0;
  const canNext = index >= 0 && index < model.strikeUsdValues.length - 1;
  const hasStrikes = model.strikeUsdValues.length > 0;

  return (
    <>
      <FlowStepHeading
        eyebrow={t("termStrike.stepLabel")}
        title={t.rich("termStrike.title", highlightTags)}
      />
      <div className="mb-5 -mt-4">
        <BTCPriceChart mode="buyer" compact />
      </div>
      <div className="mb-5">
        <FlowTermGrid
          termDays={model.termDays}
          selectedTerm={model.selectedTermDay}
          onSelect={model.setTerm}
        />
      </div>
      {hasStrikes ? (
        <FlowStepperPicker
          value={`$${model.selectedStrikeUsd.toLocaleString()}`}
          caption={t("termStrike.percentAbove", {
            percent: model.strikePercent,
          })}
          canPrev={canPrev}
          canNext={canNext}
          onPrev={() => canPrev && model.handleStrikeUsdChange(model.strikeUsdValues[index - 1])}
          onNext={() => canNext && model.handleStrikeUsdChange(model.strikeUsdValues[index + 1])}
        />
      ) : (
        <p className="text-center text-muted-foreground text-sm">{t("termStrike.noLiquidity")}</p>
      )}
      <div className="mt-6">
        <FlowInfoPanel>{t("termStrike.explain")}</FlowInfoPanel>
      </div>
    </>
  );
}

function AmountStep({ model, onDepositClick }: { model: BuyModel; onDepositClick: () => void }) {
  const t = useTranslations("BuyFlow");
  const tForms = useTranslations("Forms");
  return (
    <>
      <FlowStepHeading
        eyebrow={t("amount.stepLabel")}
        title={t.rich("amount.title", highlightTags)}
      />
      {model.isBalanceLoading ? (
        <>
          <MobileAmountInputSkeleton />
          <Skeleton className="h-9 w-full mt-4 rounded-md" />
          <Skeleton className="h-8 w-full mt-3 rounded-md" />
        </>
      ) : (
        <><MobileAmountInput
        eyebrow={tForms("amount")}
        amountSats={model.amountSats}
        btcPrice={model.btcPrice}
        maxAmountSats={model.maxPremiumAmountSats}
        minAmountSats={model.depositMinSats}
        onAmountSatsChange={model.setAmountSats}
        onDepositClick={onDepositClick}
      />

          <Badge
            className={cn(
              "w-full flex justify-between px-4 mt-4",
              model.leverage === 0 && "opacity-20",
            )}
          >
            <span className="text-sm">{t("amount.leverage")}</span>
            <span className="text-base font-bold tabular-nums">{roundToN(model.leverage, 0)}x</span>
          </Badge>

          <div className="mt-3">
            <FlowInfoPanel>{t("amount.explain")}</FlowInfoPanel>
          </div>
        </>
      )}
    </>
  );
}

function ReviewStep({ model, feePercent }: { model: BuyModel; feePercent: number }) {
  const t = useTranslations("BuyFlow");
  const tForms = useTranslations("Forms");
  const tSummary = useTranslations("Summary");
  const termLabel = tForms(model.selectedTermDay === 1 ? "day" : "days").toLowerCase();
  const premiumBtc = satsToBtc(model.amountSats);
  const premiumUsd = Math.round(premiumBtc * model.btcPrice);
  const maxProfitSats = Math.max(model.quantitySats - model.amountSats, 0);
  const maxProfitBtc = satsToBtc(maxProfitSats);
  const maxProfitUsd = Math.round(maxProfitBtc * model.btcPrice);
  const strikeDisplay = `$${model.selectedStrikeUsd.toLocaleString()}`;
  const maxProfitDisplay = `₿${maxProfitBtc.toFixed(6)}`;

  const rows: SummaryRow[] = [
    { label: t("review.strike"), value: strikeDisplay },
    { label: t("review.term"), value: `${model.selectedTermDay} ${termLabel}` },
    {
      label: t("review.premium"),
      value: `₿${formatBtc(model.amountSats, 6)} · $${premiumUsd.toLocaleString()}`,
    },
    { label: t("review.leverage"), value: `${model.leverage.toFixed(1)}x` },
    {
      label: t("review.maxProfit"),
      value: `${maxProfitDisplay} · $${maxProfitUsd.toLocaleString()}`,
      accent: true,
    },
    {
      label: t("review.platformFee"),
      value: tSummary("buyExplainer.platformFeeDesc", { fee: feePercent }),
    },
  ];

  const scenarios: Scenario[] = [
    {
      condition: tSummary("buyExplainer.ifRises", { strike: strikeDisplay }),
      outcome: tSummary("buyExplainer.ifRisesDesc", {
        maxProfit: maxProfitDisplay,
      }),
    },
    {
      condition: tSummary("buyExplainer.ifBelow", { strike: strikeDisplay }),
      outcome: tSummary("buyExplainer.ifBelowDesc"),
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

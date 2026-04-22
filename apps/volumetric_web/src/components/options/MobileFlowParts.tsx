"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  FileSignature,
  type LucideIcon,
  Send,
  SparklesIcon,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import type { AcceptOfferStep, CreateOfferStep } from "@/hooks";
import { RESOURCE_LINKS } from "@/lib/site-links";
import { cn } from "@/lib/utils";

export function FlowStepHeading({
  eyebrow,
  title,
  className,
}: {
  eyebrow: string;
  title: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-6", className)}>
      <p className="text-xs text-muted-foreground/60 uppercase mb-2">{eyebrow}</p>
      <h2 className="text-xl leading-snug">{title}</h2>
    </div>
  );
}

export const highlightTags = {
  highlight: (chunks: ReactNode) => <span className="text-primary">{chunks}</span>,
  line: (chunks: ReactNode) => <span className="block">{chunks}</span>,
};

export function FlowInfoPanel({ children }: { children: ReactNode }) {
  return (
    <div className="w-full border rounded-md p-2 pl-3 text-[13px] text-muted-foreground flex items-center gap-2">
      <SparklesIcon className="size-4 min-w-4" />
      <span className="min-w-0">{children}</span>
    </div>
  );
}

export function FlowStepperPicker({
  value,
  caption,
  eyebrow,
  canPrev,
  canNext,
  onPrev,
  onNext,
}: {
  value: string;
  caption?: ReactNode;
  eyebrow?: string;
  canPrev: boolean;
  canNext: boolean;
  onPrev: () => void;
  onNext: () => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <Button
        variant="outline"
        size="icon"
        className="shrink-0 size-12"
        disabled={!canPrev}
        onClick={onPrev}
      >
        <ChevronLeft className="size-6" />
      </Button>
      <div className="flex-1 text-center -mb-1">
        {eyebrow ? (
          <p className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground mb-2">
            {eyebrow}
          </p>
        ) : null}
        <p className="text-2xl leading-none font-bold tabular-nums">{value}</p>
        {caption ? <div className="text-sm text-muted-foreground mt-1">{caption}</div> : null}
      </div>
      <Button
        variant="outline"
        size="icon"
        className="shrink-0 size-12"
        disabled={!canNext}
        onClick={onNext}
      >
        <ChevronRight className="size-6" />
      </Button>
    </div>
  );
}

export function FlowTermGrid({
  termDays,
  selectedTerm,
  onSelect,
}: {
  termDays: readonly number[];
  selectedTerm: number;
  onSelect: (days: number) => void;
}) {
  const tForms = useTranslations("Forms");
  return (
    <div className="grid grid-cols-3 gap-3">
      {termDays.map((days) => {
        const selected = days === selectedTerm;
        const label = tForms(days === 1 ? "day" : "days").toLowerCase();
        return (
          <Button
            key={days}
            variant="outline"
            onClick={() => onSelect(days)}
            className={cn(selected && "ring-2 ring-primary")}
          >
            <p className="text-md leading-none font-bold text-card-foreground">{days}</p>
            <p className="text-sm text-muted-foreground capitalize">{label}</p>
          </Button>
        );
      })}
    </div>
  );
}

export interface SummaryRow {
  label: string;
  value: ReactNode;
  accent?: boolean;
}

export function FlowSummaryCard({ rows }: { rows: SummaryRow[] }) {
  return (
    <div className="rounded-lg border divide-y divide-border/60 overflow-hidden">
      {rows.map((row) => (
        <div key={row.label} className="flex items-center justify-between px-3 py-1.5 gap-4">
          <span className="text-[13px] text-muted-foreground">{row.label}</span>
          <span
            className={cn(
              "text-[13px] font-semibold text-right tabular-nums",
              row.accent && "text-foreground",
            )}
          >
            {row.value}
          </span>
        </div>
      ))}
    </div>
  );
}

export interface Scenario {
  condition: string;
  outcome: string;
}

type OfferFlowStep = CreateOfferStep | AcceptOfferStep;

export type FlowStepTone = "progress" | "success" | "error";

export interface FlowStepperStep {
  id: string;
  icon: LucideIcon;
  title: string;
  description?: ReactNode;
  tone?: FlowStepTone;
}

export function FlowStepper({ step }: { step: FlowStepperStep }) {
  const tone = step.tone ?? "progress";
  const Icon = step.icon;
  const isProgress = tone === "progress";

  return (
    <div className="flex-1 flex flex-col items-center justify-center py-6 min-h-[260px]">
      <AnimatePresence mode="wait">
        <motion.div
          key={step.id}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          className="flex flex-col items-center gap-5 w-full"
        >
          <div className="relative size-16 flex items-center justify-center">
            {isProgress && (
              <motion.svg
                role="presentation"
                viewBox="0 0 100 100"
                className="absolute -inset-2 size-20 text-primary"
                animate={{ rotate: 360 }}
                transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}
              >
                <circle
                  cx="50"
                  cy="50"
                  r="48"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeOpacity="0.12"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="48"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeDasharray="70 230"
                />
              </motion.svg>
            )}
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 220, damping: 18 }}
              className={cn(
                "relative size-16 rounded-full flex items-center justify-center",
                tone === "progress" && "bg-primary/10",
                tone === "success" && "bg-green-500/10",
                tone === "error" && "bg-destructive/10",
              )}
            >
              <Icon
                className={cn(
                  "size-7",
                  tone === "progress" && "text-primary",
                  tone === "success" && "size-8 text-green-500",
                  tone === "error" && "size-8 text-destructive",
                )}
              />
            </motion.div>
          </div>

          <div className="text-center space-y-1.5 max-w-xs">
            <h3 className="text-xl font-semibold leading-tight">{step.title}</h3>
            {step.description && (
              <p
                className={cn(
                  "text-sm leading-relaxed",
                  tone === "error" ? "text-destructive" : "text-muted-foreground",
                )}
              >
                {step.description}
              </p>
            )}
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

export function FlowOfferStatus({
  type,
  step,
  errorMessage,
}: {
  type: "create" | "buy";
  step: OfferFlowStep;
  errorMessage?: string;
}) {
  const t = useTranslations();
  const tCommon = useTranslations("Common");

  const stage: FlowStepperStep | null =
    step === "signing"
      ? {
          id: "signing",
          icon: FileSignature,
          tone: "progress",
          title: type === "create" ? t("OfferResult.signOffer") : t("OfferResult.signPurchase"),
          description:
            type === "create" ? t("OfferResult.approveOffer") : t("OfferResult.approvePurchase"),
        }
      : step === "submitting"
        ? {
            id: "submitting",
            icon: Send,
            tone: "progress",
            title: type === "create" ? t("OfferResult.creatingOffer") : t("OfferResult.processing"),
            description:
              type === "create"
                ? t("OfferResult.submittingOffer")
                : t("OfferResult.confirmingPurchase"),
          }
        : step === "success"
          ? {
              id: "success",
              icon: CheckCircle2,
              tone: "success",
              title:
                type === "create"
                  ? t("OfferResult.offerCreated")
                  : t("OfferResult.optionPurchased"),
              description:
                type === "create" ? t("OfferResult.offerLive") : t("OfferResult.optionActive"),
            }
          : step === "error"
            ? {
                id: "error",
                icon: XCircle,
                tone: "error",
                title: tCommon("somethingWentWrong"),
                description: errorMessage || tCommon("somethingWentWrong"),
              }
            : null;

  if (!stage) return null;

  return <FlowStepper step={stage} />;
}

export function FlowScenariosCard({ scenarios }: { scenarios: Scenario[] }) {
  const tCommon = useTranslations("Common");
  return (
    <div className="rounded-lg border bg-muted/20 px-3 py-3 space-y-2">
      <div className="flex gap-2.5">
        <div className="space-y-1.5 text-xs leading-relaxed text-muted-foreground flex-1 min-w-0">
          {scenarios.map((scenario) => (
            <p key={scenario.condition}>
              <span className="font-medium text-foreground">{scenario.condition}</span>{" "}
              {scenario.outcome}
            </p>
          ))}
        </div>
      </div>
      <Link href={RESOURCE_LINKS.docs} target="_blank">
        <Button variant="outline" size="sm" className="h-6 w-full text-xs">
          {tCommon("learnMore")}
        </Button>
      </Link>
    </div>
  );
}

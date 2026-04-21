"use client";

import { ChevronLeft, ChevronRight, SparklesIcon } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
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
            className={cn(selected && "ring-1")}
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

export function FlowScenariosCard({ scenarios }: { scenarios: Scenario[] }) {
  const tCommon = useTranslations("Common");
  return (
    <div className="rounded-lg border bg-muted/20 px-3 py-3 space-y-2">
      <div className="flex gap-2.5">
        <div className="space-y-1.5 text-[13px] leading-relaxed text-muted-foreground flex-1 min-w-0">
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

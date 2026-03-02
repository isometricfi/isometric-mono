"use client";

import { useTranslations } from "next-intl";
import { useId } from "react";
import { AnimatedToggle } from "@/components/navigation/AnimatedToggle";
import { useConfig } from "@/hooks";
import { Skeleton } from "../ui/skeleton";

interface TermSelectorProps {
  value: number;
  onChange: (value: number) => void;
}

export function TermSelector({ value, onChange }: TermSelectorProps) {
  const t = useTranslations("Forms");
  const { data: config } = useConfig();
  const termOptions = config?.termOptions ?? [];
  const layoutId = useId();

  const options = termOptions.map((term) => ({
    value: term,
    label: `${term} ${t("days")}`,
  }));

  if (termOptions.length === 0) {
    return <Skeleton className="h-9 w-full" />;
  }
  return (
    <AnimatedToggle
      options={options}
      value={value}
      onChange={onChange}
      layoutId={`termSelector-${layoutId}`}
      className="w-full "
    />
  );
}

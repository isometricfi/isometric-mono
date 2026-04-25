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
  const layoutId = useId();

  if (!config) {
    return <Skeleton className="h-9 w-full" />;
  }

  if (config.termOptions.length === 0) {
    return null;
  }

  const options = config.termOptions.map((term) => ({
    value: term,
    label: `${term} ${t(term === 1 ? "day" : "days")}`,
  }));

  return (
    <AnimatedToggle
      options={options}
      value={value}
      onChange={onChange}
      layoutId={`termSelector-${layoutId}`}
    />
  );
}

"use client";

import { TrendingDown, TrendingUp } from "lucide-react";
import { useTranslations } from "next-intl";
import { AnimatedToggle, type ToggleOption } from "@/components/navigation/AnimatedToggle";
import { cn } from "@/lib/utils";
import type { OptionType } from "@/types/ui";

interface OptionTypeToggleProps {
  value: OptionType;
  onChange: (value: OptionType) => void;
  disabled?: boolean;
}

export function OptionTypeToggle({ value, onChange, disabled }: OptionTypeToggleProps) {
  const t = useTranslations("Forms");

  const optionTypeOptions: ToggleOption<OptionType>[] = [
    { value: "call", label: t("call"), icon: TrendingUp },
    { value: "put", label: t("put"), icon: TrendingDown },
  ];

  return (
    <div className={cn(disabled && "opacity-50 pointer-events-none")}>
      <AnimatedToggle
        options={optionTypeOptions}
        value={value}
        onChange={onChange}
        layoutId="optionType"
      />
    </div>
  );
}

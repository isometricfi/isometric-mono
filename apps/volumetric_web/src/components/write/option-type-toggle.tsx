"use client";

import { TrendingUp, TrendingDown } from "lucide-react";
import {
  AnimatedToggle,
  type ToggleOption,
} from "@/components/navigation/animated-toggle";

export type OptionType = "call" | "put";

const optionTypeOptions: ToggleOption<OptionType>[] = [
  { value: "call", label: "Call", icon: TrendingUp },
  { value: "put", label: "Put", icon: TrendingDown },
];

interface OptionTypeToggleProps {
  value: OptionType;
  onChange: (value: OptionType) => void;
  disabled?: boolean;
}

export function OptionTypeToggle({
  value,
  onChange,
  disabled,
}: OptionTypeToggleProps) {
  return (
    <div className={disabled ? "opacity-50 pointer-events-none" : ""}>
      <AnimatedToggle
        options={optionTypeOptions}
        value={value}
        onChange={onChange}
        layoutId="optionType"
      />
    </div>
  );
}


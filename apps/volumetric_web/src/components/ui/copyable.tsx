"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check, Copy } from "lucide-react";
import { type ButtonHTMLAttributes, type ReactNode, useState } from "react";
import { cn } from "@/lib/utils";

interface CopyableProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onClick"> {
  text: string;
  children: ReactNode;
  iconClassName?: string;
  resetMs?: number;
}

export function Copyable({
  text,
  children,
  className,
  iconClassName,
  resetMs = 2000,
  "aria-label": ariaLabel,
  ...buttonProps
}: CopyableProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), resetMs);
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label={copied ? "Copied" : (ariaLabel ?? "Copy")}
      className={cn(
        "group inline-flex items-center gap-1 rounded transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
      {...buttonProps}
    >
      {children}
      <AnimatePresence mode="wait" initial={false}>
        {copied ? (
          <motion.span
            key="check"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="inline-flex"
          >
            <Check className={cn("size-3", iconClassName)} />
          </motion.span>
        ) : (
          <motion.span
            key="copy"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="inline-flex opacity-60 group-hover:opacity-100"
          >
            <Copy className={cn("size-3", iconClassName)} />
          </motion.span>
        )}
      </AnimatePresence>
    </button>
  );
}

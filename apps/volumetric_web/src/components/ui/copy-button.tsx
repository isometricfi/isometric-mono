"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check, Copy } from "lucide-react";
import { type ButtonHTMLAttributes, type ReactNode, useState } from "react";
import { Button } from "@/components/ui/button";

interface CopyButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "size"> {
  text: string;
  children?: ReactNode;
  size?: "default" | "sm" | "lg" | "icon" | "icon-sm" | "icon-lg";
}

export function CopyButton({ text, children, size, ...buttonProps }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isIconOnly = !children;
  const defaultSize = isIconOnly ? "icon" : "default";
  const defaultVariant = "outline";

  return (
    <Button
      variant={defaultVariant}
      size={size ?? defaultSize}
      onClick={handleCopy}
      {...buttonProps}
    >
      <AnimatePresence mode="wait" initial={false}>
        {copied ? (
          <motion.div
            key="check"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <Check className="size-4" />
          </motion.div>
        ) : (
          <motion.div
            key="copy"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <Copy className="size-4" />
          </motion.div>
        )}
      </AnimatePresence>
      {children}
    </Button>
  );
}

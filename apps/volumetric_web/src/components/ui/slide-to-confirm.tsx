"use client";

import { motion, useMotionValue, useTransform } from "framer-motion";
import { ChevronRight, Loader2 } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const MotionButton = motion.create(Button);

interface SlideToConfirmProps {
  label: string;
  processingLabel?: string;
  disabled?: boolean;
  isProcessing?: boolean;
  onConfirm: () => void;
  variant?: "primary" | "destructive";
}

const THUMB_SIZE = 40;
const TRACK_PADDING = 4;
const CONFIRM_THRESHOLD = 0.9;

export function SlideToConfirm({
  label,
  processingLabel,
  disabled = false,
  isProcessing = false,
  onConfirm,
  variant = "primary",
}: SlideToConfirmProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [trackWidth, setTrackWidth] = useState(0);
  const x = useMotionValue(0);

  const maxX = Math.max(0, trackWidth - THUMB_SIZE - TRACK_PADDING * 2);

  useLayoutEffect(() => {
    if (!trackRef.current) return;
    const update = () => {
      if (trackRef.current) setTrackWidth(trackRef.current.clientWidth);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(trackRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!isProcessing) x.set(0);
  }, [isProcessing, x]);

  const labelOpacity = useTransform(x, [0, maxX * 0.3], [1, 0]);
  const labelScale = useTransform(x, [0, maxX * 0.3], [1, 0.85]);
  const fillWidth = useTransform(x, (value) => value + THUMB_SIZE + TRACK_PADDING + 4);
  const arrowOpacity = useTransform(x, [0, maxX * 0.4], [1, 0.3]);

  const handleDragEnd = () => {
    if (disabled || isProcessing) return;
    if (x.get() >= maxX * CONFIRM_THRESHOLD) {
      x.set(maxX);
      onConfirm();
    } else {
      x.set(0);
    }
  };

  const isDraggable = !disabled && !isProcessing && maxX > 0;
  const isDestructive = variant === "destructive";

  return (
    <div
      ref={trackRef}
      className={cn(
        "relative h-12 w-full rounded-lg overflow-hidden select-none touch-none shadow-lg shadow-primary/20",
        disabled ? "bg-muted" : "bg-muted/70 border border-border",
      )}
    >
      {!disabled && (
        <motion.div
          aria-hidden
          className={cn(
            "absolute top-0 left-0 h-full pointer-events-none rounded-r-md",
            isDestructive ? "bg-destructive/20" : "bg-primary/20",
          )}
          style={{ width: fillWidth }}
        />
      )}

      <motion.div
        className="absolute inset-0 flex items-center justify-center pointer-events-none px-16"
        style={{ opacity: labelOpacity, scale: labelScale }}
      >
        <span
          className={cn(
            "text-sm font-semibold text-center",
            disabled ? "text-muted-foreground" : "text-foreground",
          )}
        >
          {isProcessing ? (processingLabel ?? label) : label}
        </span>
      </motion.div>

      <MotionButton
        type="button"
        variant={isDestructive ? "destructive" : "default"}
        size="icon-lg"
        disabled={disabled}
        drag={isDraggable ? "x" : false}
        dragConstraints={{ left: 0, right: maxX }}
        dragElastic={0}
        dragMomentum={false}
        style={{ x }}
        onDragEnd={handleDragEnd}
        whileTap={isDraggable ? { scale: 0.96 } : undefined}
        className={cn(
          "absolute top-[3px] left-[3px] shadow-md transition-none",
          isDraggable && "cursor-grab active:cursor-grabbing",
        )}
      >
        {isProcessing ? (
          <Loader2 className="size-5 animate-spin" />
        ) : (
          <motion.span style={{ opacity: arrowOpacity }} className="inline-flex">
            <ChevronRight className="size-6" />
          </motion.span>
        )}
      </MotionButton>
    </div>
  );
}

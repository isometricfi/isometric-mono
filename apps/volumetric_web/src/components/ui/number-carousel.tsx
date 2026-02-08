"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { useLayoutEffect, useRef } from "react";
import { Button } from "@/components/ui/button";

interface NumberCarouselProps {
  values: number[];
  value: number;
  onChange: (value: number) => void;
  formatValue?: (value: number) => string;
}

type Direction = 1 | -1;

// iOS-style picker positions with 3D-like scaling and opacity
// using fixed pixel values for consistent spacing regardless of text width
const POSITIONS = {
  farLeft: { x: -120, scale: 0, opacity: 0 },
  left: { x: -80, scale: 0.7, opacity: 0.4 },
  center: { x: 0, scale: 1, opacity: 1 },
  right: { x: 80, scale: 0.7, opacity: 0.4 },
  farRight: { x: 120, scale: 0.6, opacity: 0 },
};

export function NumberCarousel({
  values,
  value,
  onChange,
  formatValue = (v) => v.toString(),
}: NumberCarouselProps) {
  const currentIndex = values.indexOf(value);
  const prevIndexRef = useRef<number | null>(null);
  const directionRef = useRef<Direction>(1);

  // compute direction synchronously during render
  if (prevIndexRef.current !== null && prevIndexRef.current !== currentIndex) {
    directionRef.current = currentIndex > prevIndexRef.current ? 1 : -1;
  }

  useLayoutEffect(() => {
    prevIndexRef.current = currentIndex;
  }, [currentIndex]);

  const direction = directionRef.current;

  // get visible values (2 on each side + center)
  const getVisibleValues = () => {
    const visible: { val: number; position: keyof typeof POSITIONS }[] = [];

    if (currentIndex >= 2) {
      visible.push({ val: values[currentIndex - 2], position: "farLeft" });
    }
    if (currentIndex >= 1) {
      visible.push({ val: values[currentIndex - 1], position: "left" });
    }
    visible.push({ val: values[currentIndex], position: "center" });
    if (currentIndex < values.length - 1) {
      visible.push({ val: values[currentIndex + 1], position: "right" });
    }
    if (currentIndex < values.length - 2) {
      visible.push({ val: values[currentIndex + 2], position: "farRight" });
    }

    return visible;
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      onChange(values[currentIndex - 1]);
    }
  };

  const handleNext = () => {
    if (currentIndex < values.length - 1) {
      onChange(values[currentIndex + 1]);
    }
  };

  // get initial position based on direction for enter animation
  const getInitialPosition = (position: keyof typeof POSITIONS) => {
    if (direction > 0) {
      // moving to higher index, new items enter from right
      if (position === "farRight") return POSITIONS.farRight;
      if (position === "right") return POSITIONS.farRight;
      if (position === "center") return POSITIONS.right;
      if (position === "left") return POSITIONS.center;
      return POSITIONS.left;
    }
    // moving to lower index, new items enter from left
    if (position === "farLeft") return POSITIONS.farLeft;
    if (position === "left") return POSITIONS.farLeft;
    if (position === "center") return POSITIONS.left;
    if (position === "right") return POSITIONS.center;
    return POSITIONS.right;
  };

  if (values.length === 0) {
    return (
      <div className="flex items-center justify-center py-3 px-4 bg-secondary/50 rounded-md">
        <span className="text-sm text-muted-foreground">No values available</span>
      </div>
    );
  }

  const visibleValues = getVisibleValues();

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="secondary"
        size="icon"
        onClick={handlePrev}
        disabled={currentIndex <= 0}
        className="rounded-md shrink-0"
      >
        <ArrowLeft className="size-4" />
      </Button>

      <div className="flex-1 relative h-9 overflow-hidden bg-secondary/30 rounded-md">
        <div className="absolute inset-0 flex items-center justify-center">
          <AnimatePresence initial={false} mode="popLayout">
            {visibleValues.map(({ val, position }) => {
              const pos = POSITIONS[position];
              const isCenter = position === "center";
              const isClickable = position === "left" || position === "right";

              return (
                <motion.button
                  key={val}
                  type="button"
                  onClick={() => {
                    if (position === "left") handlePrev();
                    if (position === "right") handleNext();
                  }}
                  disabled={!isClickable}
                  initial={getInitialPosition(position)}
                  animate={{
                    x: pos.x,
                    scale: pos.scale,
                    opacity: pos.opacity,
                  }}
                  exit={{
                    x: direction > 0 ? -80 : 80,
                    scale: 0.5,
                    opacity: 0,
                  }}
                  transition={{
                    type: "spring",
                    stiffness: 300,
                    damping: 30,
                  }}
                  className={`absolute font-semibold whitespace-nowrap ${
                    isCenter
                      ? "md:text-lg text-base  text-foreground"
                      : "md:text-base text-sm text-muted-foreground cursor-pointer"
                  } ${!isClickable && !isCenter ? "pointer-events-none" : ""}`}
                >
                  {formatValue(val)}
                </motion.button>
              );
            })}
          </AnimatePresence>
        </div>
      </div>

      <Button
        variant="default"
        size="icon"
        onClick={handleNext}
        disabled={currentIndex >= values.length - 1}
        className="rounded-md shrink-0"
      >
        <ArrowRight className="size-4" />
      </Button>
    </div>
  );
}

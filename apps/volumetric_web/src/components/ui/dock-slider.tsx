"use client";

import { animate, type MotionValue, motion, useMotionValue, useTransform } from "framer-motion";
import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

interface DockSliderProps<T> {
  values: readonly T[];
  value: T;
  onChange: (value: T) => void;
  renderLabel: (value: T, isActive: boolean) => React.ReactNode;
  itemWidth?: number;
  height?: number;
}

const DEFAULT_ITEM_WIDTH = 68;
const DEFAULT_HEIGHT = 64;
const SPRING = { type: "spring" as const, stiffness: 320, damping: 32 };

export function DockSlider<T>({
  values,
  value,
  onChange,
  renderLabel,
  itemWidth = DEFAULT_ITEM_WIDTH,
  height = DEFAULT_HEIGHT,
}: DockSliderProps<T>) {
  const selectedIndex = Math.max(0, values.indexOf(value));
  const x = useMotionValue(-selectedIndex * itemWidth);
  const draggingRef = useRef(false);

  useEffect(() => {
    if (draggingRef.current) return;
    const controls = animate(x, -selectedIndex * itemWidth, SPRING);
    return () => controls.stop();
  }, [selectedIndex, itemWidth, x]);

  const handleDragEnd = () => {
    draggingRef.current = false;
    const offset = x.get();
    const nearest = Math.round(-offset / itemWidth);
    const clamped = Math.max(0, Math.min(values.length - 1, nearest));
    const nextValue = values[clamped];
    if (nextValue !== value) {
      onChange(nextValue);
    } else {
      animate(x, -selectedIndex * itemWidth, SPRING);
    }
  };

  const maxLeft = -(values.length - 1) * itemWidth;

  return (
    <div className="relative w-full overflow-hidden select-none" style={{ height }}>
      <div
        aria-hidden
        className="absolute left-1/2 top-0 bottom-0 w-px bg-primary/40 -translate-x-1/2 pointer-events-none"
      />
      <motion.div
        drag="x"
        style={{ x, left: `calc(50% - ${itemWidth / 2}px)` }}
        dragConstraints={{ left: maxLeft, right: 0 }}
        dragElastic={0.08}
        dragMomentum={false}
        onDragStart={() => {
          draggingRef.current = true;
        }}
        onDragEnd={handleDragEnd}
        className="absolute inset-y-0 flex items-center touch-none cursor-grab active:cursor-grabbing"
      >
        {values.map((v, i) => (
          <DockItem
            key={String(v)}
            index={i}
            x={x}
            itemWidth={itemWidth}
            isActive={i === selectedIndex}
            onTap={() => {
              if (v !== value) onChange(v);
            }}
          >
            {renderLabel(v, i === selectedIndex)}
          </DockItem>
        ))}
      </motion.div>
    </div>
  );
}

function DockItem({
  index,
  x,
  itemWidth,
  isActive,
  onTap,
  children,
}: {
  index: number;
  x: MotionValue<number>;
  itemWidth: number;
  isActive: boolean;
  onTap: () => void;
  children: React.ReactNode;
}) {
  const distance = useTransform(x, (currentX) => Math.abs(index * itemWidth + currentX));
  const scale = useTransform(
    distance,
    [0, itemWidth, itemWidth * 2, itemWidth * 3],
    [1.3, 0.9, 0.7, 0.55],
  );
  const opacity = useTransform(distance, [0, itemWidth, itemWidth * 3], [1, 0.6, 0.25]);

  return (
    <motion.button
      type="button"
      onClick={onTap}
      style={{ scale, opacity, width: itemWidth }}
      className={cn(
        "flex-shrink-0 flex items-center justify-center text-sm font-semibold tabular-nums",
        isActive ? "text-foreground" : "text-muted-foreground",
      )}
    >
      {children}
    </motion.button>
  );
}

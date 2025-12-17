"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatedToggle, type ToggleOption } from "@/components/navigation/AnimatedToggle";
import { useConfig } from "@/hooks/useConfig";
import { useOptions } from "@/hooks/useOptions";
import { usePrices } from "@/hooks/usePrices";
import { cn, formatBtc } from "@/lib/utils";
import type { StrikeBucket } from "@/types/options";
import type { ViewerMode } from "@/types/ui";

interface StrikeRowProps {
  bucket: StrikeBucket;
  btcPrice: number;
  isExpanded: boolean;
  onToggle: () => void;
  mode: ViewerMode;
}

function StrikeRow({ bucket, btcPrice, isExpanded, onToggle, mode }: StrikeRowProps) {
  const strikeUsd = Math.round(btcPrice * (1 + bucket.strikePercent / 100));
  const scrollRef = useRef<HTMLDivElement>(null);
  const [hasScrolled, setHasScrolled] = useState(false);
  const isScrollable = bucket.offers.length > 4;

  // reset scroll state when collapsed
  useEffect(() => {
    if (!isExpanded) {
      setHasScrolled(false);
    }
  }, [isExpanded]);

  const handleScroll = () => {
    if (!hasScrolled) {
      setHasScrolled(true);
    }
  };

  return (
    <div className=" rounded-2xl overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full pl-0 pr-2 md:px-4 py-3 flex items-center gap-2 md:gap-3 hover:bg-secondary/30 transition-colors"
      >
        <motion.div animate={{ rotate: isExpanded ? 90 : 0 }} transition={{ duration: 0.15 }}>
          <ChevronRight className="size-4 text-muted-foreground" />
        </motion.div>

        {/* strike - USD primary for buyers, % primary for writers */}
        <div className="flex-1 text-left">
          {mode === "buyer" ? (
            <>
              {btcPrice > 0 && (
                <span className="text-sm md:text-base font-medium">
                  ${strikeUsd.toLocaleString()}
                </span>
              )}
              <span className={cn("text-xs text-green-500", btcPrice > 0 ? "ml-2" : "")}>
                +{bucket.strikePercent}%
              </span>
            </>
          ) : (
            <>
              <span className="text-sm md:text-base font-medium text-green-500">
                +{bucket.strikePercent}%
              </span>
              {btcPrice > 0 && (
                <span className="ml-2 text-xs text-muted-foreground">
                  ~${strikeUsd.toLocaleString()}
                </span>
              )}
            </>
          )}
        </div>

        {/* premium range */}
        <div className="w-16 md:w-24 text-right">
          <span className="text-xs md:text-sm text-muted-foreground">
            {bucket.lowestPremium === bucket.highestPremium
              ? `${bucket.lowestPremium}%`
              : `${bucket.lowestPremium}-${bucket.highestPremium}%`}
          </span>
        </div>

        {/* total liquidity */}
        <div className="w-20 md:w-28 text-right">
          <span className="text-sm md:text-base font-medium">
            {formatBtc(bucket.totalLiquiditySats, 4)}
          </span>
          <span className="text-xs text-muted-foreground ml-1">BTC</span>
        </div>

        {/* offer count - hidden on small screens */}
        <div className="hidden md:block w-16 text-right">
          <span className="text-xs bg-secondary px-2 py-0.5 rounded-full">
            {bucket.offers.length}{" "}
          </span>
        </div>
      </button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="bg-secondary/20 border-t border-border/30">
              {/* offers header */}
              <div
                className={cn(
                  "px-4 py-2 grid text-xs text-muted-foreground border-b border-border/30",
                  mode === "buyer" ? "grid-cols-3" : "grid-cols-2",
                )}
              >
                <span className="pl-7">Premium</span>
                <span className="text-right">Amount</span>
                {mode === "buyer" && <span className="text-right">Action</span>}
              </div>

              {/* scrollable offers container */}
              <div className="relative">
                <div
                  ref={scrollRef}
                  onScroll={handleScroll}
                  className="max-h-[230px] overflow-y-auto"
                >
                  {/* individual offers */}
                  {bucket.offers
                    .sort((a, b) => a.premium - b.premium)
                    .map((offer) => (
                      <div
                        key={offer.id}
                        className={cn(
                          "px-4 py-2.5 grid items-center text-sm hover:bg-secondary/30 transition-colors",
                          mode === "buyer" ? "grid-cols-3" : "grid-cols-2",
                        )}
                      >
                        <span className="pl-7 font-medium">{offer.premium}%</span>
                        <span className="text-right">{formatBtc(offer.amountSats, 4)} BTC</span>
                        {mode === "buyer" && (
                          <div className="text-right">
                            <button
                              type="button"
                              className="text-xs bg-primary text-primary-foreground px-3 py-1 rounded-full hover:bg-primary/90 transition-colors"
                            >
                              Buy
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                </div>
                {/* scroll indicator badge */}
                <AnimatePresence>
                  {isScrollable && !hasScrolled && (
                    <motion.div
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 4 }}
                      className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1 px-2 py-1 bg-secondary/80 backdrop-blur-sm rounded-full text-xs text-muted-foreground"
                    >
                      <ChevronDown className="size-3" />
                      <span>Scroll for more</span>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

interface OptionsViewerProps {
  mode: ViewerMode;
}

export function OptionsViewer({ mode }: OptionsViewerProps) {
  const { data, isLoading } = useOptions();
  const { data: priceData } = usePrices();
  const { data: config } = useConfig();
  const btcPrice = priceData?.btc ?? 0;

  const termOptions: ToggleOption<string>[] = useMemo(() => {
    if (!config) return [];
    return config.termOptions.map((term) => ({
      value: term.toString(),
      label: term === 1 ? "<1d" : `${term}d`,
    }));
  }, [config]);

  const defaultTerm = config?.termOptions[0]?.toString() ?? "7";
  const [selectedTerm, setSelectedTerm] = useState<string>(defaultTerm);
  const [expandedStrikePercent, setExpandedStrikePercent] = useState<number | null>(null);

  const currentTermGroup = data?.termGroups.find((group) => group.term.toString() === selectedTerm);

  const handleToggleStrike = (strikePercent: number) => {
    setExpandedStrikePercent((prev) => (prev === strikePercent ? null : strikePercent));
  };

  const formatExpiryDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  };

  return (
    <div className="bg-card rounded-3xl border border-border p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Available Options</h2>
        <AnimatedToggle
          options={termOptions}
          value={selectedTerm}
          onChange={setSelectedTerm}
          layoutId="optionsViewerTerm"
          size="sm"
        />
      </div>

      {currentTermGroup && (
        <>
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>Expires {formatExpiryDate(currentTermGroup.expiryDate)}</span>
            {btcPrice > 0 && <span>BTC: ${btcPrice.toLocaleString()}</span>}
          </div>

          <div className=" overflow-hidden space-y-2">
            {/* header row */}
            <div className="pl-0 pr-2 md:px-4 rounded-2xl py-2 grid grid-cols-[1fr_auto_auto] md:grid-cols-[1fr_auto_auto_auto] gap-2 md:gap-3 text-xs text-muted-foreground bg-secondary/30">
              <span className="pl-6 md:pl-7">Strike</span>
              <span className="w-16 md:w-24 text-right">Premium</span>
              <span className="w-20 md:w-28 text-right">Liquidity</span>
              <span className="hidden md:block w-16 text-right">Offers</span>
            </div>

            {/* strike rows */}
            <div className=" overflow-y-auto">
              {currentTermGroup.strikes.map((bucket) => (
                <StrikeRow
                  key={bucket.strikePercent}
                  bucket={bucket}
                  btcPrice={btcPrice}
                  isExpanded={expandedStrikePercent === bucket.strikePercent}
                  onToggle={() => handleToggleStrike(bucket.strikePercent)}
                  mode={mode}
                />
              ))}
            </div>
          </div>
        </>
      )}

      {isLoading && (
        <div className="text-center py-12">
          <p className="text-muted-foreground">Loading options...</p>
        </div>
      )}

      {!isLoading && (!currentTermGroup || currentTermGroup.strikes.length === 0) && (
        <div className="text-center py-12">
          <p className="text-muted-foreground">No options available</p>
          <p className="text-sm text-muted-foreground mt-1">Be the first to write an option!</p>
        </div>
      )}
    </div>
  );
}

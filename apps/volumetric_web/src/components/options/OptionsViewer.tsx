"use client";

import { format } from "date-fns";
import { AnimatePresence, motion } from "framer-motion";
import { Atom, BookOpen, ChevronDown, ChevronRight, User } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatedToggle, type ToggleOption } from "@/components/navigation/AnimatedToggle";
import { useAccount, useActiveOptions, useConfig, useOptions, usePrices } from "@/hooks";
import { getStrikeUsd } from "@/lib/options-form";
import { cn, formatBtcWithSymbol } from "@/lib/utils";
import type { StrikeBucket } from "@/types/options";
import type { ViewerMode } from "@/types/ui";
import { Card, CardContent } from "../ui/card";

type Dataset = "orders" | "active";

function formatExpiresAt(iso: string): string {
  const d = new Date(iso);
  const ms = d.getTime() - Date.now();
  const minutes = Math.round(ms / 60_000);
  if (minutes <= 0) return "now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return format(d, "MMM d");
}

interface StrikeRowProps {
  bucket: StrikeBucket;
  btcPrice: number;
  isExpanded: boolean;
  onToggle: () => void;
  mode: ViewerMode;
  dataset: Dataset;
  currentUserId?: string;
}

function StrikeRow({
  bucket,
  btcPrice,
  isExpanded,
  onToggle,
  mode,
  dataset,
  currentUserId,
}: StrikeRowProps) {
  const t = useTranslations("OptionsViewer");
  const strikeUsd = getStrikeUsd(btcPrice, bucket.strikePercent);
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
    <div className=" rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full pl-0 pr-2 md:px-4 py-3 flex items-center gap-2 md:gap-3 hover:bg-secondary/30 transition-colors"
      >
        <motion.div animate={{ rotate: isExpanded ? 90 : 0 }} transition={{ duration: 0.15 }}>
          <ChevronRight className="size-4 text-muted-foreground" />
        </motion.div>

        {/* strike - for orders: USD-primary (buyer) or %-primary (writer); for active: only %, since each position has its own absolute strike */}
        <div className="flex-1 text-left">
          {dataset === "active" ? (
            <span className="text-sm md:text-base font-medium text-green-500">
              +{bucket.strikePercent}%
            </span>
          ) : mode === "buyer" ? (
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
            {formatBtcWithSymbol(bucket.totalLiquiditySats, 6)}
          </span>
        </div>

        {/* offer count - hidden on small screens */}
        <div className="hidden md:block w-16 text-right">
          <span className="text-xs bg-secondary px-2 py-0.5 rounded-sm">
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
                  dataset === "active" ? "grid-cols-4" : "grid-cols-2",
                )}
              >
                <span className="pl-7">{t("premium")}</span>
                {dataset === "active" && (
                  <>
                    <span className="text-right">{t("strike")}</span>
                    <span className="text-right">{t("expires")}</span>
                  </>
                )}
                <span className="text-right">{t("amount")}</span>
              </div>

              {/* scrollable offers container */}
              <div className="relative">
                <div
                  ref={scrollRef}
                  onScroll={handleScroll}
                  className="max-h-[230px] overflow-y-auto"
                >
                  {/* individual offers */}
                  {[...bucket.offers]
                    .sort((a, b) =>
                      dataset === "active"
                        ? new Date(a.expiresAt).getTime() - new Date(b.expiresAt).getTime()
                        : a.premium - b.premium,
                    )
                    .map((offer) => {
                      const isMine =
                        !!currentUserId &&
                        (offer.writerId === currentUserId || offer.buyerId === currentUserId);
                      return (
                        <div
                          key={offer.id}
                          className={cn(
                            "relative px-4 py-2.5 grid items-center text-sm hover:bg-secondary/30 transition-colors",
                            dataset === "active" ? "grid-cols-4" : "grid-cols-2",
                          )}
                        >
                          {isMine && (
                            <div className="absolute left-4 top-1/2 -translate-y-1/2">
                              <User className="size-4 text-primary fill-primary/20" />
                            </div>
                          )}
                          <span className="pl-7 font-medium">{offer.premium}%</span>
                          {dataset === "active" && (
                            <>
                              <span className="text-right text-muted-foreground">
                                {offer.strikeUsd != null
                                  ? `$${offer.strikeUsd.toLocaleString()}`
                                  : "—"}
                              </span>
                              <span className="text-right text-muted-foreground tabular-nums">
                                {formatExpiresAt(offer.expiresAt)}
                              </span>
                            </>
                          )}
                          <span className="text-right">
                            {formatBtcWithSymbol(offer.amountSats, 6)}
                          </span>
                        </div>
                      );
                    })}
                </div>
                {/* scroll indicator badge */}
                <AnimatePresence>
                  {isScrollable && !hasScrolled && (
                    <motion.div
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 4 }}
                      className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1 px-2 py-1 bg-secondary/80 backdrop-blur-sm rounded-md text-xs text-muted-foreground"
                    >
                      <ChevronDown className="size-3" />
                      <span>{t("scrollForMore")}</span>
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
  const t = useTranslations("OptionsViewer");
  const locale = useLocale();
  const { data: ordersData, isLoading: isLoadingOrders } = useOptions();
  const { data: activeData, isLoading: isLoadingActive } = useActiveOptions();
  const { data: priceData } = usePrices();
  const { data: config } = useConfig();
  const { data: account } = useAccount();
  const btcPrice = priceData?.btc ?? 0;
  const currentUserId = account?.profile?.principal;

  const [dataset, setDataset] = useState<Dataset>("orders");

  const isLoading = dataset === "orders" ? isLoadingOrders : isLoadingActive;

  const datasetOptions: ToggleOption<Dataset>[] = useMemo(
    () => [
      { value: "orders", label: t("orders"), icon: BookOpen },
      { value: "active", label: t("active"), icon: Atom },
    ],
    [t],
  );

  const termOptions: ToggleOption<string>[] = useMemo(() => {
    if (!config) return [];
    const daysLabel = t("daysShort");
    return config.termOptions.map((term) => ({
      value: term.toString(),
      label: term === 1 ? `<1${daysLabel}` : `${term}${daysLabel}`,
    }));
  }, [config, t]);

  const defaultTerm = config?.termOptions[0]?.toString() ?? "7";
  const [selectedTerm, setSelectedTerm] = useState<string>(defaultTerm);
  const [expandedStrikePercent, setExpandedStrikePercent] = useState<number | null>(null);

  const sourceData = dataset === "orders" ? ordersData : activeData;
  const currentTermGroup = sourceData?.termGroups.find(
    (group) => group.term.toString() === selectedTerm,
  );

  const visibleStrikes: StrikeBucket[] = currentTermGroup?.strikes ?? [];

  const handleToggleStrike = (strikePercent: number) => {
    setExpandedStrikePercent((prev) => (prev === strikePercent ? null : strikePercent));
  };

  return (
    <Card>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <AnimatedToggle
            options={datasetOptions}
            value={dataset}
            onChange={setDataset}
            layoutId="optionsViewerDataset"
            size="sm"
          />
          <AnimatedToggle
            options={termOptions}
            value={selectedTerm}
            onChange={setSelectedTerm}
            layoutId="optionsViewerTerm"
            size="sm"
          />
        </div>

        {visibleStrikes.length > 0 && (
          <>
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              {dataset === "orders" && currentTermGroup ? (
                <span>
                  {t("expires")}{" "}
                  {formatOrdersHeadlineSettlesOnMonthDayUtc(currentTermGroup.term, locale)}
                </span>
              ) : (
                <span />
              )}
              {btcPrice > 0 && <span>BTC: ${Math.round(btcPrice).toLocaleString()}</span>}
            </div>

            <div className=" overflow-hidden space-y-2">
              <div className="pl-0 pr-2 md:px-4 rounded-lg py-2 grid grid-cols-[1fr_auto_auto] md:grid-cols-[1fr_auto_auto_auto] gap-2 md:gap-3 text-xs text-muted-foreground bg-secondary/30">
                <span className="pl-6 md:pl-7">{t("strike")}</span>
                <span className="w-16 md:w-24 text-right">{t("premium")}</span>
                <span className="w-20 md:w-28 text-right">
                  {dataset === "orders" ? t("liquidity") : t("amount")}
                </span>
                <span className="hidden md:block w-16 text-right">
                  {dataset === "orders" ? t("offers") : t("positions")}
                </span>
              </div>

              {/* strike rows */}
              <div className=" overflow-y-auto">
                {visibleStrikes.map((bucket) => (
                  <StrikeRow
                    key={bucket.strikePercent}
                    bucket={bucket}
                    btcPrice={btcPrice}
                    isExpanded={expandedStrikePercent === bucket.strikePercent}
                    onToggle={() => handleToggleStrike(bucket.strikePercent)}
                    mode={mode}
                    dataset={dataset}
                    currentUserId={currentUserId}
                  />
                ))}
              </div>
            </div>
          </>
        )}

        {isLoading && (
          <div className="text-center py-12">
            <p className="text-muted-foreground">{t("loadingOptions")}</p>
          </div>
        )}

        {!isLoading && visibleStrikes.length === 0 && (
          <div className="text-center py-12">
            <p className="text-muted-foreground">
              {dataset === "orders" ? t("noOptionsAvailable") : t("noActiveOptions")}
            </p>
            {dataset === "orders" && (
              <p className="text-sm text-muted-foreground mt-1">{t("beFirstToWrite")}</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// UTC calendar day + term: same headline for every client. TermGroup.expiryDate is min offer listing TTL.
function formatOrdersHeadlineSettlesOnMonthDayUtc(
  termDays: number,
  locale: string,
  now: Date = new Date(),
): string {
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const d = now.getUTCDate();
  const settlesUtc = new Date(Date.UTC(y, m, d + termDays));
  return new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(settlesUtc);
}

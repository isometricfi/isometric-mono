"use client";

import { useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { usePrices } from "@/hooks";
import { useBTCHistory } from "@/hooks/queries/use-btc-history";
import { useChartOptionsStore } from "@/stores/chart-options-store";
import { Card, CardContent } from "../ui/card";

const EXTRA_DAYS_AFTER_EXPIRY = 3;
const CHART_PADDING = { top: 10, right: 10, bottom: 25, left: 45 };

interface BTCPriceChartProps {
  mode: "buyer" | "writer";
}

interface DataPoint {
  date: string;
  price: number | null;
  timestamp: number;
}

export function BTCPriceChart({ mode }: BTCPriceChartProps) {
  const t = useTranslations("Components");
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  const { data: historyData, isLoading: historyLoading } = useBTCHistory(30);
  const { data: priceData } = usePrices();
  const { strikePercent, termDays } = useChartOptionsStore();

  const currentPrice = priceData?.btc ?? 0;
  const strikePrice = currentPrice * (1 + strikePercent / 100);

  useEffect(() => {
    if (historyLoading || !containerRef.current) return;

    const updateDimensions = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
      }
    };

    updateDimensions();

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setDimensions({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
      }
    });

    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, [historyLoading]);

  useEffect(() => {
    if (containerRef.current && historyData && historyData.length > 0) {
      setDimensions({
        width: containerRef.current.clientWidth,
        height: containerRef.current.clientHeight,
      });
    }
  }, [historyData]);

  const { chartData, expiryIndex } = useMemo(() => {
    if (!historyData || historyData.length === 0) {
      return { chartData: [], expiryIndex: -1 };
    }

    const historicalPoints: DataPoint[] = historyData.map((point) => ({
      date: point.date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      price: point.price,
      timestamp: point.timestamp,
    }));

    const lastPoint = historyData[historyData.length - 1];
    const futureDays = termDays + EXTRA_DAYS_AFTER_EXPIRY;
    const futurePoints: DataPoint[] = [];

    for (let i = 1; i <= futureDays; i++) {
      const futureDate = new Date(lastPoint.timestamp + i * 24 * 60 * 60 * 1000);
      futurePoints.push({
        date: futureDate.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        price: null,
        timestamp: futureDate.getTime(),
      });
    }

    const expiryTimestamp = lastPoint.timestamp + termDays * 24 * 60 * 60 * 1000;
    const expiryDateStr = new Date(expiryTimestamp).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });

    const allData = [...historicalPoints, ...futurePoints];
    const expIdx = allData.findIndex((d) => d.date === expiryDateStr);

    return {
      chartData: allData,
      expiryIndex: expIdx,
    };
  }, [historyData, termDays]);

  const { minPrice, maxPrice } = useMemo(() => {
    if (chartData.length === 0) return { minPrice: 0, maxPrice: 100000 };

    const prices = chartData.filter((d) => d.price !== null).map((d) => d.price as number);
    const allPrices = [...prices, strikePrice];
    const min = Math.min(...allPrices);
    const max = Math.max(...allPrices);
    const padding = (max - min) * 0.15;

    return {
      minPrice: min - padding,
      maxPrice: max + padding,
    };
  }, [chartData, strikePrice]);

  const chartWidth = dimensions.width - CHART_PADDING.left - CHART_PADDING.right;
  const chartHeight = dimensions.height - CHART_PADDING.top - CHART_PADDING.bottom;

  const scaleX = useMemo(() => {
    return (index: number) => {
      if (chartData.length <= 1) return CHART_PADDING.left;
      return CHART_PADDING.left + (index / (chartData.length - 1)) * chartWidth;
    };
  }, [chartData.length, chartWidth]);

  const scaleY = useMemo(() => {
    return (price: number) => {
      const range = maxPrice - minPrice;
      if (range === 0) return CHART_PADDING.top + chartHeight / 2;
      return CHART_PADDING.top + ((maxPrice - price) / range) * chartHeight;
    };
  }, [minPrice, maxPrice, chartHeight]);

  const pricePath = useMemo(() => {
    const validPoints = chartData
      .map((d, i) => ({ ...d, index: i }))
      .filter((d) => d.price !== null);

    if (validPoints.length === 0) return "";

    const pathParts = validPoints.map((point, i) => {
      const x = scaleX(point.index);
      const y = scaleY(point.price as number);
      return i === 0 ? `M ${x} ${y}` : `L ${x} ${y}`;
    });

    return pathParts.join(" ");
  }, [chartData, scaleX, scaleY]);

  const areaPath = useMemo(() => {
    const validPoints = chartData
      .map((d, i) => ({ ...d, index: i }))
      .filter((d) => d.price !== null);

    if (validPoints.length === 0) return "";

    const lineParts = validPoints.map((point, i) => {
      const x = scaleX(point.index);
      const y = scaleY(point.price as number);
      return i === 0 ? `M ${x} ${y}` : `L ${x} ${y}`;
    });

    const lastValidPoint = validPoints[validPoints.length - 1];
    const firstValidPoint = validPoints[0];
    const bottomY = CHART_PADDING.top + chartHeight;

    return `${lineParts.join(" ")} L ${scaleX(lastValidPoint.index)} ${bottomY} L ${scaleX(firstValidPoint.index)} ${bottomY} Z`;
  }, [chartData, scaleX, scaleY, chartHeight]);

  const lastPriceIndex = chartData.findIndex((d) => d.price === null) - 1;
  const todayIndex = lastPriceIndex >= 0 ? lastPriceIndex : chartData.length - 1;
  const todayX = scaleX(todayIndex);
  const currentPriceY = scaleY(currentPrice);

  const expiryX = expiryIndex >= 0 ? scaleX(expiryIndex) : 0;
  const strikeY = scaleY(strikePrice);
  const zoneEndIndex = Math.min(expiryIndex + 3, chartData.length - 1);
  const zoneEndX = scaleX(zoneEndIndex);

  const profitColor = mode === "buyer" ? "34, 197, 94" : "239, 68, 68";
  const lossColor = mode === "buyer" ? "239, 68, 68" : "34, 197, 94";

  const yTicks = useMemo(() => {
    const range = maxPrice - minPrice;
    const step = range / 4;
    return [0, 1, 2, 3, 4].map((i) => maxPrice - i * step);
  }, [minPrice, maxPrice]);

  const xTicks = useMemo(() => {
    if (chartData.length === 0) return [];
    const indices = [
      0,
      Math.floor(chartData.length / 3),
      Math.floor((2 * chartData.length) / 3),
      chartData.length - 1,
    ];
    return indices.map((i) => ({ index: i, label: chartData[i]?.date ?? "" }));
  }, [chartData]);

  if (historyLoading) {
    return (
      <div className="bg-card rounded-3xl border border-border p-6 h-full min-h-64 md:max-h-none max-h-64">
        <Skeleton className="w-full h-full rounded-2xl" />
      </div>
    );
  }

  return (
    <Card>
      <CardContent className="h-full flex flex-col min-h-64 md:max-h-none max-h-64">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-semibold">{t("btcUsd")}</h2>
          {currentPrice > 0 && (
            <span className="text-lg font-semibold">
              ${currentPrice.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </span>
          )}
        </div>

        <div ref={containerRef} className="w-full flex-1 min-h-0">
          {dimensions.width > 0 && dimensions.height > 0 && chartData.length > 0 && (
            <svg
              width={dimensions.width}
              height={dimensions.height}
              className="overflow-visible"
              role="img"
              aria-labelledby="btc-chart-title"
            >
              <title id="btc-chart-title">BTC/USD price chart with strike price projection</title>
              <defs>
                <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--chart-1))" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="hsl(var(--chart-1))" stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="strikeLineGradient" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#71717a" stopOpacity={0.8} />
                  <stop offset="100%" stopColor="#71717a" stopOpacity={0} />
                </linearGradient>
                <radialGradient id="profitZoneGradient" cx="0%" cy="100%" r="100%">
                  <stop offset="0%" stopColor={`rgb(${profitColor})`} stopOpacity={0.4} />
                  <stop offset="60%" stopColor={`rgb(${profitColor})`} stopOpacity={0.1} />
                  <stop offset="100%" stopColor={`rgb(${profitColor})`} stopOpacity={0} />
                </radialGradient>
                <radialGradient id="lossZoneGradient" cx="0%" cy="0%" r="100%">
                  <stop offset="0%" stopColor={`rgb(${lossColor})`} stopOpacity={0.4} />
                  <stop offset="60%" stopColor={`rgb(${lossColor})`} stopOpacity={0.1} />
                  <stop offset="100%" stopColor={`rgb(${lossColor})`} stopOpacity={0} />
                </radialGradient>
              </defs>

              {yTicks.map((tick) => (
                <g key={tick}>
                  <line
                    x1={CHART_PADDING.left}
                    y1={scaleY(tick)}
                    x2={CHART_PADDING.left + chartWidth}
                    y2={scaleY(tick)}
                    stroke="hsl(var(--border))"
                    strokeOpacity={0.5}
                    strokeWidth={1}
                  />
                  <text
                    x={CHART_PADDING.left - 8}
                    y={scaleY(tick)}
                    textAnchor="end"
                    dominantBaseline="middle"
                    className="fill-muted-foreground text-[11px]"
                  >
                    ${(tick / 1000).toFixed(0)}k
                  </text>
                </g>
              ))}

              {xTicks.map(({ index, label }) => (
                <text
                  key={index}
                  x={scaleX(index)}
                  y={CHART_PADDING.top + chartHeight + 18}
                  textAnchor="middle"
                  className="fill-muted-foreground text-[11px]"
                >
                  {label}
                </text>
              ))}

              {expiryIndex >= 0 && (
                <>
                  <rect
                    x={expiryX}
                    y={CHART_PADDING.top}
                    width={zoneEndX - expiryX}
                    height={strikeY - CHART_PADDING.top}
                    fill="url(#profitZoneGradient)"
                  />
                  <rect
                    x={expiryX}
                    y={strikeY}
                    width={zoneEndX - expiryX}
                    height={CHART_PADDING.top + chartHeight - strikeY}
                    fill="url(#lossZoneGradient)"
                  />

                  <line
                    x1={todayX}
                    y1={currentPriceY}
                    x2={expiryX}
                    y2={currentPriceY}
                    stroke="#71717a"
                    strokeWidth={1}
                    strokeOpacity={0.4}
                    strokeDasharray="4 4"
                  />
                  <text
                    x={(todayX + expiryX) / 2}
                    y={currentPriceY - 8}
                    textAnchor="middle"
                    className="fill-muted-foreground text-[10px]"
                  >
                    {t("days", { count: termDays })}
                  </text>

                  <line
                    x1={expiryX}
                    y1={CHART_PADDING.top}
                    x2={expiryX}
                    y2={CHART_PADDING.top + chartHeight}
                    stroke="#71717a"
                    strokeWidth={1}
                    strokeOpacity={0.5}
                  />

                  <line
                    x1={expiryX}
                    y1={strikeY}
                    x2={zoneEndX}
                    y2={strikeY}
                    stroke="url(#strikeLineGradient)"
                    strokeWidth={2}
                  />

                  <circle cx={expiryX} cy={strikeY} r={5} fill="#71717a" />
                  <text
                    x={expiryX - 10}
                    y={strikeY}
                    textAnchor="end"
                    dominantBaseline="middle"
                    className="fill-muted-foreground text-xs font-medium"
                  >
                    {t("strike")}: $
                    {strikePrice.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </text>
                </>
              )}

              <path d={areaPath} fill="url(#areaGradient)" />
              <path
                d={pricePath}
                fill="none"
                stroke="hsl(var(--chart-1))"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

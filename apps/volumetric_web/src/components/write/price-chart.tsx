interface PriceChartProps {
  className?: string;
}

export function PriceChart({ className }: PriceChartProps) {
  return (
    <div
      className={`bg-card rounded-3xl border border-border overflow-hidden ${
        className ?? ""
      }`}
    >
      {/* placeholder for chart - will be replaced with actual trading view or chart library */}
      <div className="w-full h-full min-h-[400px] flex items-center justify-center">
        <div className="text-center space-y-2">
          <div className="text-muted-foreground text-sm">
            BTC/USD Price Chart
          </div>
          <div className="text-xs text-muted-foreground/60">
            Chart coming soon
          </div>
        </div>
      </div>
    </div>
  );
}


import { Blocks, TrendingUp, Zap } from "lucide-react";
import { useTranslations } from "next-intl";
import { PayoffVisualization } from "./PayoffVisualization";
import { YieldDisplay } from "./YieldDisplay";

export function TwoPathsSection() {
  const t = useTranslations("Landing");

  return (
    <div className="relative z-10 flex flex-col items-center pb-16">
      <div className="max-w-5xl w-full px-4">
        {/* the two paths */}
        <div className="relative grid md:grid-cols-2 gap-16 md:gap-24 mb-20">
          {/* vertical divider line with fade */}
          <div className="hidden md:block absolute left-1/2 top-0 bottom-0 -translate-x-1/2 w-px">
            {/* radial gradient mask at top */}
            <div
              className="absolute -top-12 left-1/2 -translate-x-1/2 w-24 h-24 pointer-events-none z-10"
              style={{
                background: "radial-gradient(circle, hsl(var(--background)) 30%, transparent 70%)",
              }}
            />
            {/* the line - uses border color for light/dark mode */}
            <div
              className="absolute inset-0 bg-border"
              style={{
                maskImage:
                  "linear-gradient(to bottom, transparent 0%, black 8%, black 92%, transparent 100%)",
                WebkitMaskImage:
                  "linear-gradient(to bottom, transparent 0%, black 8%, black 92%, transparent 100%)",
              }}
            />
          </div>
          {/* buyers / leverage side */}
          <div>
            <div className="mb-8">
              <div className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-muted-foreground mb-3">
                <Zap className="size-3" />
                {t("forTraders")}
              </div>
              <h2 className="text-xl md:text-2xl font-bold mb-3">{t("leverageTitle")}</h2>
              <p className="text-muted-foreground">{t("leverageDescription")}</p>
            </div>

            <PayoffVisualization />
          </div>

          {/* writers / yield side */}
          <div>
            <div className="mb-8">
              {/* mobile horizontal divider */}
              <div className="md:hidden relative w-full h-px mb-6">
                {/* radial gradient mask */}
                <div
                  className="absolute -left-12 top-1/2 -translate-y-1/2 w-24 h-24 pointer-events-none z-10"
                  style={{
                    background:
                      "radial-gradient(circle, hsl(var(--background)) 30%, transparent 70%)",
                  }}
                />
                {/* the line */}
                <div
                  className="absolute inset-0 bg-border"
                  style={{
                    maskImage:
                      "linear-gradient(to right, transparent 0%, black 8%, black 92%, transparent 100%)",
                    WebkitMaskImage:
                      "linear-gradient(to right, transparent 0%, black 8%, black 92%, transparent 100%)",
                  }}
                />
              </div>

              <div className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-muted-foreground mb-3">
                <TrendingUp className="size-3" />
                {t("forHodlers")}
              </div>
              <h2 className="text-xl md:text-2xl font-bold mb-3">{t("earnYieldTitle")}</h2>
              <p className="text-muted-foreground text-sm md:text-base">
                {t("earnYieldDescription")}
              </p>
            </div>

            <YieldDisplay />
          </div>
        </div>

        {/* trust badges */}
        <div className="flex flex-wrap items-center justify-center gap-6 md:gap-10 mt-12 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Blocks className="size-5 text-primary" />
            <span>{t("btcNative")}</span>
          </div>
          <div className="flex items-center gap-2">
            <Zap className="size-5 text-primary" />
            <span>{t("instantSettlement")}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";

import { ArrowLeft, RotateCcw, Zap } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/routing";

export default function LocaleError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("AppError");

  useEffect(() => {
    if (typeof console !== "undefined") {
      console.error(error);
    }
  }, [error]);

  return (
    <div className="relative flex min-h-[80vh] flex-col items-center justify-center overflow-hidden py-16 md:py-24">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 flex items-center justify-center"
      >
        <div className="size-[520px] max-w-full rounded-full bg-destructive/10 blur-3xl" />
      </div>

      <div className="relative z-10 mx-auto flex w-full max-w-2xl flex-col items-center text-center">
        <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-destructive/20 bg-destructive/10 px-4 py-1.5 font-medium text-destructive text-sm tracking-wide">
          <Zap className="size-4 [animation:err-jolt_1.6s_ease-in-out_infinite]" />
          {t("title")}
        </div>

        <h1 className="mb-4 font-bold text-3xl tracking-tight sm:text-4xl md:text-5xl">
          {t("heading")}
        </h1>

        <p className="mb-8 max-w-md text-base text-muted-foreground sm:text-lg">
          {t("description")}
        </p>

        <div className="flex flex-col items-center gap-3 sm:flex-row">
          <Button size="lg" onClick={reset}>
            <RotateCcw className="size-4" />
            {t("tryAgain")}
          </Button>
          <Button size="lg" variant="outline" asChild>
            <Link href="/">
              <ArrowLeft className="size-4" />
              {t("backHome")}
            </Link>
          </Button>
        </div>

        {error.digest && (
          <p className="mt-10 font-mono text-muted-foreground/60 text-xs">
            {t("errorId")}: {error.digest}
          </p>
        )}
      </div>

      <style>{`
        @keyframes err-jolt {
          0%, 100% { transform: rotate(0deg); }
          20% { transform: rotate(-12deg); }
          40% { transform: rotate(10deg); }
          60% { transform: rotate(-6deg); }
          80% { transform: rotate(4deg); }
        }
      `}</style>
    </div>
  );
}

"use client";

import { useMutation } from "@tanstack/react-query";
import { RotateCcw } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { resetDemoSession } from "@/lib/demo/demo-canister-browser";

export function DemoBanner() {
  const t = useTranslations("DemoMode");
  const resetMutation = useMutation({
    mutationFn: resetDemoSession,
    onSuccess: () => window.location.reload(),
  });

  return (
    <aside
      aria-live="polite"
      className="sticky top-0 z-50 -mx-4 flex min-h-10 items-center justify-center gap-3 border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 text-amber-950 backdrop-blur dark:text-amber-100"
    >
      <p className="text-center text-xs sm:text-sm">
        <strong className="font-semibold">{t("title")}</strong>
        <span className="hidden sm:inline"> {t("description")}</span>
      </p>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="h-7 shrink-0 border-amber-600/30 bg-background/60 px-2 text-xs"
        disabled={resetMutation.isPending}
        onClick={() => resetMutation.mutate()}
      >
        <RotateCcw className="size-3" aria-hidden="true" />
        {resetMutation.isPending ? t("resetting") : t("reset")}
      </Button>
    </aside>
  );
}

"use client";

import { useLocale, useTranslations } from "next-intl";
import { useTransition } from "react";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { Button } from "@/components/ui/button";
import { usePathname, useRouter } from "@/i18n/routing";
import { useProMode } from "@/stores/preferences-store";

export function SystemSettings({ showHeading = true }: { showHeading?: boolean }) {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const t = useTranslations("AccountPanel");
  const tSettings = useTranslations("Settings");
  const [isPending, startTransition] = useTransition();
  const { isProMode, setProMode } = useProMode();

  const handleLocaleChange = (newLocale: string) => {
    startTransition(() => {
      router.replace(pathname, { locale: newLocale });
    });
  };

  return (
    <div className="space-y-2">
      {showHeading && <div className="text-sm text-muted-foreground">{t("system")}</div>}
      <div className="flex items-center justify-between bg-secondary/50 rounded-lg px-4 py-3">
        <span className="text-sm font-medium">{tSettings("appearance")}</span>
        <ThemeToggle />
      </div>
      <div className="flex items-center justify-between bg-secondary/50 rounded-lg px-4 py-3">
        <span className="text-sm font-medium">{tSettings("language")}</span>
        <div className="flex gap-2">
          <Button
            variant={locale === "en" ? "default" : "ghost"}
            size="sm"
            onClick={() => handleLocaleChange("en")}
            disabled={isPending}
            className="h-8 px-3"
          >
            EN
          </Button>
          <Button
            variant={locale === "zh" ? "default" : "ghost"}
            size="sm"
            onClick={() => handleLocaleChange("zh")}
            disabled={isPending}
            className="h-8 px-3"
          >
            中文
          </Button>
        </div>
      </div>
      <div className="flex items-center justify-between bg-secondary/50 rounded-lg px-4 py-3">
        <span className="text-sm font-medium">{tSettings("proMode")}</span>
        <div className="flex gap-2">
          <Button
            variant={!isProMode ? "default" : "ghost"}
            size="sm"
            onClick={() => setProMode(false)}
            className="h-8 px-3"
          >
            {tSettings("off")}
          </Button>
          <Button
            variant={isProMode ? "default" : "ghost"}
            size="sm"
            onClick={() => setProMode(true)}
            className="h-8 px-3"
          >
            {tSettings("on")}
          </Button>
        </div>
      </div>
    </div>
  );
}

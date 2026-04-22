"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Monitor, Moon, Settings, Sun } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { useEffect, useState, useTransition } from "react";
import { useProMode } from "@/components/layout/ProModeProvider";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { usePathname, useRouter } from "@/i18n/routing";

export function SettingsDropdown() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const t = useTranslations("Settings");
  const [isPending, startTransition] = useTransition();
  const { isProMode, setProMode } = useProMode();

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleLocaleChange = (newLocale: string) => {
    startTransition(() => {
      router.replace(pathname, { locale: newLocale });
    });
  };

  if (!mounted) {
    return (
      <Button variant="ghost" size="icon" aria-label="Settings" disabled>
        <Settings className="size-5" />
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Settings">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={theme}
              initial={{ rotate: -90, filter: "blur(0px)", scale: 0.8 }}
              animate={{ rotate: 0, filter: "blur(0px)", scale: 1 }}
              exit={{ rotate: 90, filter: "blur(0px)", scale: 0.8 }}
              transition={{ duration: 0.3 }}
            >
              <Settings className="size-5" />
            </motion.div>
          </AnimatePresence>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel>{t("appearance")}</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={theme} onValueChange={setTheme}>
          <DropdownMenuRadioItem value="light">
            <Sun className="size-4 mr-2" />
            {t("light")}
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="dark">
            <Moon className="size-4 mr-2" />
            {t("dark")}
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="system">
            <Monitor className="size-4 mr-2" />
            {t("system")}
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>

        <DropdownMenuSeparator />

        <DropdownMenuLabel>{t("language")}</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={locale} onValueChange={handleLocaleChange}>
          <DropdownMenuRadioItem value="en" disabled={isPending}>
            {t("english")}
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="zh" disabled={isPending}>
            {t("chinese")}
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>

        <DropdownMenuSeparator />

        <DropdownMenuLabel>{t("advanced")}</DropdownMenuLabel>
        <DropdownMenuCheckboxItem checked={isProMode} onCheckedChange={setProMode}>
          {t("proMode")}
        </DropdownMenuCheckboxItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

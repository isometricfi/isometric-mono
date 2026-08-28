"use client";

import { ArrowRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { appUrl } from "@/lib/urls";

export function ShareCta() {
  const t = useTranslations("SharePage");

  return (
    <Button asChild size="lg" className="w-full">
      <a href={appUrl("/write")}>
        {t("startTrading")}
        <ArrowRight className="size-4 ml-1" />
      </a>
    </Button>
  );
}

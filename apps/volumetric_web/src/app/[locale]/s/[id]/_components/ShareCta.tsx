"use client";

import { useDynamicContext } from "@dynamic-labs/sdk-react-core";
import { ArrowRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { useDynamicConfig } from "@/app/providers/dynamic-provider";
import { Button } from "@/components/ui/button";
import { appUrl } from "@/lib/urls";

export function ShareCta() {
  const { setShowAuthFlow, primaryWallet } = useDynamicContext();
  const { isConfigured } = useDynamicConfig();
  const t = useTranslations("SharePage");

  if (!primaryWallet) {
    return (
      <Button
        size="lg"
        className="w-full"
        disabled={!isConfigured}
        onClick={() => setShowAuthFlow(true)}
      >
        {t("joinNow")}
        <ArrowRight className="size-4 ml-1" />
      </Button>
    );
  }

  return (
    <Button asChild size="lg" className="w-full">
      <a href={appUrl("/write")}>
        {t("startTrading")}
        <ArrowRight className="size-4 ml-1" />
      </a>
    </Button>
  );
}

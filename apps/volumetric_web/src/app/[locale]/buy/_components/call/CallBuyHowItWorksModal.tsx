"use client";

import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface CallBuyHowItWorksModalProps {
  trigger: ReactNode;
}

export function CallBuyHowItWorksModal({ trigger }: CallBuyHowItWorksModalProps) {
  const t = useTranslations("HowItWorks.Buy");

  return (
    <Dialog>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <div>
            <p className="font-medium">{t("step1Title")}</p>
            <p className="text-muted-foreground">{t("step1Description")}</p>
          </div>

          <div>
            <p className="font-medium">{t("step2Title")}</p>
            <p className="text-muted-foreground">
              <span className="font-medium">{t("below")}</span> {t("belowDescription")}{" "}
              <span className="font-medium">{t("above")}</span> {t("aboveDescription")}
            </p>
          </div>

          <div>
            <p className="font-medium">{t("coveredCalls")}</p>
            <p className="text-muted-foreground">{t("coveredCallsDescription")}</p>
          </div>

          <div className="pt-2 border-t border-border">
            <p className="text-xs text-muted-foreground">{t("example")}</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

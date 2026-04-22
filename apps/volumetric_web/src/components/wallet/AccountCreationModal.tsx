"use client";

import { FileSignature, ShieldCheck, Sparkles, XCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMediaQuery } from "react-responsive";
import { FlowStepper, type FlowStepperStep } from "@/components/options/MobileFlowParts";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerTitle } from "@/components/ui/drawer";
import type { EnsureAccountStep } from "@/hooks";

export function AccountCreationModal({
  open,
  step,
  error,
  onClose,
}: {
  open: boolean;
  step: EnsureAccountStep;
  error: string | null;
  onClose: () => void;
}) {
  const isMobile = useMediaQuery({ query: "(max-width: 768px)" });
  const t = useTranslations();
  const tCommon = useTranslations("Common");
  const showClose = step === "error" || step === "awaiting_signature";

  const stage: FlowStepperStep | null =
    step === "checking"
      ? {
          id: "checking",
          icon: ShieldCheck,
          tone: "progress",
          title: t("AccountCreation.settingUp"),
          description: t("AccountCreation.preparing"),
        }
      : step === "awaiting_signature"
        ? {
            id: "awaiting_signature",
            icon: FileSignature,
            tone: "progress",
            title: t("AccountCreation.approveCreation"),
            description: t("AccountCreation.signMessage"),
          }
        : step === "creating"
          ? {
              id: "creating",
              icon: Sparkles,
              tone: "progress",
              title: t("AccountCreation.creating"),
              description: t("AccountCreation.finalizing"),
            }
          : step === "error"
            ? {
                id: "error",
                icon: XCircle,
                tone: "error",
                title: tCommon("somethingWentWrong"),
                description: error ?? t("AccountCreation.errorDescription"),
              }
            : null;

  const handleOpenChange = (next: boolean) => {
    if (!next) onClose();
  };

  const body = (
    <>
      <div className="px-5 pt-8 pb-6">{stage && <FlowStepper step={stage} />}</div>
      {step === "error" && (
        <div className="px-5 pb-5">
          <Button
            variant="outline"
            className="w-full h-12 text-base font-semibold"
            onClick={onClose}
          >
            {tCommon("close")}
          </Button>
        </div>
      )}
    </>
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={handleOpenChange}>
        <DrawerContent className="p-0 pb-4">
          <DrawerTitle className="sr-only">{t("AccountCreation.title")}</DrawerTitle>
          {body}
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent showCloseButton={showClose} className="sm:max-w-md p-0 gap-0 overflow-hidden">
        <DialogTitle className="sr-only">{t("AccountCreation.title")}</DialogTitle>
        {body}
      </DialogContent>
    </Dialog>
  );
}

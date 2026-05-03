"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, CheckCircle2, FileSignature, Loader2, Send, XCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMediaQuery } from "react-responsive";
import { AlertDialog, AlertDialogContent, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Drawer, DrawerContent, DrawerTitle } from "@/components/ui/drawer";
import type { AcceptOfferStep, CreateOfferStep } from "@/hooks";
import { Link } from "@/i18n/routing";
import { cn } from "@/lib/utils";

type OfferStep = CreateOfferStep | AcceptOfferStep;
type OfferResultType = "create" | "buy";

interface OfferResultModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: OfferResultType;
  step: OfferStep;
  offerId?: string;
  fillGroupId?: string;
  errorMessage?: string;
}

function getCreateSteps(t: ReturnType<typeof useTranslations>) {
  return [
    {
      id: "signing",
      title: t("OfferResult.signOffer"),
      description: t("OfferResult.approveOffer"),
      icon: FileSignature,
    },
    {
      id: "submitting",
      title: t("OfferResult.creatingOffer"),
      description: t("OfferResult.submittingOffer"),
      icon: Send,
    },
  ] as const;
}

function getBuySteps(t: ReturnType<typeof useTranslations>) {
  return [
    {
      id: "signing",
      title: t("OfferResult.signPurchase"),
      description: t("OfferResult.approvePurchase"),
      icon: FileSignature,
    },
    {
      id: "submitting",
      title: t("OfferResult.processing"),
      description: t("OfferResult.confirmingPurchase"),
      icon: Send,
    },
  ] as const;
}

function isStepActive(current: OfferStep, stepId: string): boolean {
  return current === stepId;
}

function isStepComplete(current: OfferStep, stepId: string): boolean {
  if (current === "submitting" && stepId === "signing") return true;
  if (current === "success" && (stepId === "signing" || stepId === "submitting")) return true;
  return false;
}

export function OfferResultModal({
  open,
  onOpenChange,
  type,
  step,
  fillGroupId: _fillGroupId,
  errorMessage,
}: OfferResultModalProps) {
  const isMobile = useMediaQuery({ query: "(max-width: 768px)" });
  const t = useTranslations();
  const tCommon = useTranslations("Common");
  const steps = type === "create" ? getCreateSteps(t) : getBuySteps(t);

  const isProcessing = step === "signing" || step === "submitting";
  const isSuccess = step === "success";
  const isError = step === "error";

  const getAccessibleTitle = () => {
    if (isError) return tCommon("somethingWentWrong");
    if (isSuccess)
      return type === "create" ? t("OfferResult.offerCreated") : t("OfferResult.optionPurchased");
    return type === "create" ? t("OfferResult.creatingOfferTitle") : t("OfferResult.buyingOption");
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (isProcessing) return;
    onOpenChange(nextOpen);
  };

  const content = (
    <div className="space-y-6 ">
      <AnimatePresence mode="wait">
        {(isProcessing || step === "idle") && (
          <motion.div
            key="processing"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-4"
          >
            <div className="text-center pb-2">
              <h3 className="text-lg font-semibold">
                {type === "create"
                  ? t("OfferResult.creatingOfferTitle")
                  : t("OfferResult.buyingOption")}
              </h3>
            </div>

            <div className="space-y-3">
              {steps.map((s) => {
                const active = isStepActive(step, s.id);
                const complete = isStepComplete(step, s.id);
                const Icon = s.icon;

                return (
                  <motion.div
                    key={s.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25 }}
                    className={cn(
                      "rounded-xl border p-4 transition-colors",
                      active && "border-primary/40 bg-primary/5",
                      complete && "border-border bg-card/50",
                      !active && !complete && "border-border/50 opacity-50",
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5">
                        {complete ? (
                          <CheckCircle2 className="size-5 text-primary" />
                        ) : active ? (
                          <Loader2 className="size-5 animate-spin text-primary" />
                        ) : (
                          <Icon className="size-5 text-muted-foreground" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="font-medium leading-none">{s.title}</div>
                        <div className="text-sm text-muted-foreground mt-1">{s.description}</div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        )}

        {isSuccess && (
          <motion.div
            key="success"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center justify-center  space-y-4"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{
                type: "spring",
                stiffness: 200,
                damping: 15,
                delay: 0.1,
              }}
              className="size-16 rounded-full bg-green-500/10 flex items-center justify-center"
            >
              <CheckCircle2 className="size-8 text-green-500" />
            </motion.div>

            <div className="text-center space-y-2">
              <h3 className="text-xl font-semibold">
                {type === "create"
                  ? t("OfferResult.offerCreated")
                  : t("OfferResult.optionPurchased")}
              </h3>
              <p className="text-sm text-muted-foreground">
                {type === "create" ? t("OfferResult.offerLive") : t("OfferResult.optionActive")}
              </p>
            </div>

            <div className="flex flex-col gap-3 w-full pt-2">
              <Button asChild className="w-full">
                <Link href="/portfolio">
                  {t("OfferResult.viewPortfolio")}
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button variant="outline" className="w-full" onClick={() => onOpenChange(false)}>
                {type === "create" ? tCommon("close") : t("OfferResult.buyAnother")}
              </Button>
            </div>
          </motion.div>
        )}

        {isError && (
          <motion.div
            key="error"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex flex-col items-center justify-center space-y-4"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{
                type: "spring",
                stiffness: 200,
                damping: 15,
              }}
              className="size-16 rounded-full bg-destructive/10 flex items-center justify-center"
            >
              <XCircle className="size-8 text-destructive" />
            </motion.div>

            <div className="text-center space-y-2">
              <h3 className="text-xl font-semibold">{tCommon("somethingWentWrong")}</h3>
              {errorMessage && <p className="text-sm text-destructive max-w-xs">{errorMessage}</p>}
            </div>

            <div className="flex gap-3 w-full pt-2">
              <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
                {tCommon("close")}
              </Button>
              <Button className="flex-1" onClick={() => onOpenChange(false)}>
                {tCommon("tryAgain")}
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={handleOpenChange}>
        <DrawerContent className="px-5 pb-8 pt-4">
          <DrawerTitle className="sr-only">{getAccessibleTitle()}</DrawerTitle>
          {content}
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent className="sm:max-w-md">
        <AlertDialogTitle className="sr-only">{getAccessibleTitle()}</AlertDialogTitle>
        {content}
      </AlertDialogContent>
    </AlertDialog>
  );
}

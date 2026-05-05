"use client";

import { useDynamicContext } from "@dynamic-labs/sdk-react-core";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, CircleArrowUp, FileSignature, Send, XCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { useMediaQuery } from "react-responsive";
import { AmountInput } from "@/components/options/AmountInput";
import { FlowStepper, type FlowStepperStep } from "@/components/options/MobileFlowParts";
import { AlertDialog, AlertDialogContent, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Drawer, DrawerContent, DrawerTitle } from "@/components/ui/drawer";
import { useAccount, useWithdraw, type WithdrawStep } from "@/hooks";
import { getNiceErrorMessage } from "@/lib/error-message";
import {
  formatBtcBigint,
  formatBtcWithSymbol,
  formatBtcWithSymbolBigint,
  parseBtcToSatsBigint,
} from "@/lib/utils";
import { Badge } from "../ui/badge";
import { Skeleton } from "../ui/skeleton";

const MIN_WITHDRAW_SATS = BigInt(50_100);

export function WithdrawModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const isMobile = useMediaQuery({ query: "(max-width: 768px)" });
  const { primaryWallet } = useDynamicContext();
  const { data: accountData, isLoading: isAccountLoading } = useAccount();
  const withdraw = useWithdraw();
  const t = useTranslations("Withdraw");
  const tCommon = useTranslations("Common");

  const balance = accountData?.balance;
  const profile = accountData?.profile;
  const lockedSats = balance?.locked ?? BigInt(0);
  const availableSats = balance?.available ?? BigInt(0);
  const destinationAddress = profile?.address ?? primaryWallet?.address ?? "";

  const [amountBtc, setAmountBtc] = useState("");

  const minWithdrawSats = MIN_WITHDRAW_SATS;

  const enteredAmountSats = useMemo(() => parseBtcToSatsBigint(amountBtc), [amountBtc]);
  const isBelowMinimum = enteredAmountSats < minWithdrawSats;

  const canWithdraw = useMemo(() => {
    const sats = parseBtcToSatsBigint(amountBtc);
    if (sats < minWithdrawSats) return false;
    if (sats > BigInt(availableSats)) return false;
    if (!destinationAddress) return false;
    return true;
  }, [amountBtc, availableSats, destinationAddress, minWithdrawSats]);

  const step: WithdrawStep = withdraw.step;
  const isProcessing = step === "signing" || step === "submitting";
  const showStatus = step !== "idle";

  const handleClose = (nextOpen: boolean) => {
    if (isProcessing) return;
    if (!nextOpen) {
      withdraw.reset();
      setAmountBtc("");
    }
    onOpenChange(nextOpen);
  };

  const handleWithdraw = () => {
    if (!canWithdraw) return;
    withdraw.mutate({
      amountSats: parseBtcToSatsBigint(amountBtc),
    });
  };

  const tryAgain = () => {
    withdraw.reset();
  };

  const errorMessage = getNiceErrorMessage(withdraw.error) ?? undefined;

  const stages: Record<Exclude<WithdrawStep, "idle">, FlowStepperStep> = {
    signing: {
      id: "signing",
      icon: FileSignature,
      tone: "progress",
      title: t("signMessage"),
      description: t("approveWithdrawal"),
    },
    submitting: {
      id: "submitting",
      icon: Send,
      tone: "progress",
      title: t("processingWithdrawal"),
      description: t("mayTakeMoment"),
    },
    success: {
      id: "success",
      icon: CheckCircle2,
      tone: "success",
      title: t("withdrawalSubmitted"),
      description: t("arrivesInMinutes"),
    },
    error: {
      id: "error",
      icon: XCircle,
      tone: "error",
      title: tCommon("somethingWentWrong"),
      description: errorMessage,
    },
  };
  const stage = step === "idle" ? null : stages[step];

  const content = (
    <div className="flex flex-col flex-1 md:pt-0 pt-4">
      <div className="flex-1 flex flex-col">
        <AnimatePresence mode="wait" initial={false}>
          {!showStatus ? (
            <motion.div
              key="input"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="flex-1 flex flex-col space-y-5"
            >
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <CircleArrowUp className="size-5 text-primary" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold">{t("title")}</h2>
                  <p className="text-sm text-muted-foreground">{t("description")}</p>
                </div>
              </div>

              {isAccountLoading ? (
                <>
                  <Skeleton className="w-full h-[68px] rounded-2xl" />
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Skeleton className="h-4 w-16" />
                      <Skeleton className="h-4 w-24" />
                    </div>
                    <Skeleton className="w-full h-12 rounded-md" />
                  </div>
                </>
              ) : (
                <>
                  <div className="rounded-2xl border p-4 bg-card/50">
                    <div className="text-xs text-muted-foreground mb-1">{t("destination")}</div>
                    <div className="font-mono text-xs break-all">{destinationAddress}</div>
                  </div>

                  <AmountInput
                    value={amountBtc}
                    onChange={setAmountBtc}
                    maxAmountSats={Number(availableSats)}
                    minAmountSats={Number(minWithdrawSats)}
                    maxDecimals={8}
                    onMaxClick={() => setAmountBtc(formatBtcBigint(availableSats, 8))}
                  />

                  {lockedSats > BigInt(0) && (
                    <Badge variant="secondary" className="w-full">
                      {t("lockedInOptions", {
                        amount: formatBtcWithSymbolBigint(lockedSats, 8),
                      })}
                    </Badge>
                  )}
                </>
              )}

              <div className="flex gap-3 mt-auto">
                <Button variant="outline" className="flex-1" onClick={() => handleClose(false)}>
                  {tCommon("close")}
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleWithdraw}
                  disabled={!canWithdraw || isAccountLoading}
                >
                  {isAccountLoading
                    ? t("title")
                    : isBelowMinimum
                      ? `${tCommon("min")}: ${formatBtcWithSymbol(Number(minWithdrawSats), 8)}`
                      : t("title")}
                </Button>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key={`status-${step}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="flex-1 flex flex-col"
            >
              {stage && <FlowStepper step={stage} />}

              {step === "success" && (
                <Button className="w-full mt-auto" onClick={() => handleClose(false)}>
                  {tCommon("done")}
                </Button>
              )}

              {step === "error" && (
                <div className="flex gap-3 w-full mt-auto">
                  <Button variant="outline" className="flex-1" onClick={() => handleClose(false)}>
                    {tCommon("close")}
                  </Button>
                  <Button className="flex-1" onClick={tryAgain}>
                    {tCommon("tryAgain")}
                  </Button>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={handleClose}>
        <DrawerContent className="px-5 pb-4 min-h-[70vh] flex flex-col">
          <DrawerTitle className="sr-only">{t("title")}</DrawerTitle>
          {content}
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <AlertDialog open={open} onOpenChange={handleClose}>
      <AlertDialogContent className="sm:max-w-md min-h-[400px] max-h-[400px] flex flex-col">
        <AlertDialogTitle className="sr-only">{t("title")}</AlertDialogTitle>
        {content}
      </AlertDialogContent>
    </AlertDialog>
  );
}

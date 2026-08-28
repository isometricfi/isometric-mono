"use client";

import { useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, CircleArrowDown, LoaderCircle, XCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useMediaQuery } from "react-responsive";
import { AmountInput } from "@/components/options/AmountInput";
import { FlowStepper, type FlowStepperStep } from "@/components/options/MobileFlowParts";
import { AlertDialog, AlertDialogContent, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Drawer, DrawerContent, DrawerTitle } from "@/components/ui/drawer";
import { useBtcAddress } from "@/hooks";
import { depositDemoFunds } from "@/lib/demo/demo-canister-browser";
import { getNiceErrorMessage } from "@/lib/error-message";
import { formatBtc, formatBtcWithSymbol, parseBtcToSatsBigint } from "@/lib/utils";

const MIN_DEMO_DEPOSIT_SATS = 50_000n;
const MAX_DEMO_DEPOSIT_SATS = 100_000_000n;

type DepositStep = "input" | "sending" | "success" | "error";

export function DepositModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const isMobile = useMediaQuery({ query: "(max-width: 768px)" });
  const address = useBtcAddress("payment");
  const queryClient = useQueryClient();
  const t = useTranslations("Deposit");
  const tCommon = useTranslations("Common");
  const [step, setStep] = useState<DepositStep>("input");
  const [amountBtc, setAmountBtc] = useState("");
  const [error, setError] = useState<string | null>(null);

  const enteredAmountSats = parseBtcToSatsBigint(amountBtc);
  const isBelowMinimum = enteredAmountSats < MIN_DEMO_DEPOSIT_SATS;
  const isAboveMaximum = enteredAmountSats > MAX_DEMO_DEPOSIT_SATS;
  const canDeposit = !!address && !isBelowMinimum && !isAboveMaximum;
  const isProcessing = step === "sending";

  const handleClose = (nextOpen: boolean) => {
    if (isProcessing) {
      return;
    }
    if (!nextOpen) {
      setStep("input");
      setAmountBtc("");
      setError(null);
    }
    onOpenChange(nextOpen);
  };

  const handleDeposit = async () => {
    if (!address || !canDeposit) {
      return;
    }

    setError(null);
    setStep("sending");

    try {
      await depositDemoFunds(address, enteredAmountSats);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["account"] }),
        queryClient.invalidateQueries({ queryKey: ["options"] }),
        queryClient.invalidateQueries({ queryKey: ["portfolio"] }),
      ]);
      setStep("success");
    } catch (depositError) {
      setError(getNiceErrorMessage(depositError));
      setStep("error");
    }
  };

  const stages: Record<Exclude<DepositStep, "input">, FlowStepperStep> = {
    sending: {
      id: "sending",
      icon: LoaderCircle,
      tone: "progress",
      title: t("addingDemoBalance"),
      description: t("updatingDemoBalance"),
    },
    success: {
      id: "success",
      icon: CheckCircle2,
      tone: "success",
      title: t("depositComplete"),
      description: t("balanceUpdated"),
    },
    error: {
      id: "error",
      icon: XCircle,
      tone: "error",
      title: tCommon("somethingWentWrong"),
      description: error ?? undefined,
    },
  };
  const stage = step === "input" ? null : stages[step];

  const content = (
    <div className="flex min-h-[400px] flex-1 flex-col pt-3 md:pt-0">
      <AnimatePresence mode="wait" initial={false}>
        {step === "input" ? (
          <motion.div
            key="input"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex flex-1 flex-col gap-5"
          >
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-full bg-primary/10">
                <CircleArrowDown className="size-5 text-primary" aria-hidden="true" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">{t("title")}</h2>
                <p className="text-sm text-muted-foreground">{t("description")}</p>
              </div>
            </div>

            <AmountInput
              value={amountBtc}
              onChange={setAmountBtc}
              maxAmountSats={Number(MAX_DEMO_DEPOSIT_SATS)}
              minAmountSats={Number(MIN_DEMO_DEPOSIT_SATS)}
              onMaxClick={() => setAmountBtc(formatBtc(Number(MAX_DEMO_DEPOSIT_SATS), 8))}
            />

            <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
              {t("simulationNotice")}
            </p>

            <div className="mt-auto flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => handleClose(false)}>
                {tCommon("close")}
              </Button>
              <Button className="flex-1" onClick={handleDeposit} disabled={!canDeposit}>
                {isBelowMinimum
                  ? `${tCommon("min")}: ${formatBtcWithSymbol(Number(MIN_DEMO_DEPOSIT_SATS), 8)}`
                  : isAboveMaximum
                    ? `${tCommon("max")}: ${formatBtcWithSymbol(Number(MAX_DEMO_DEPOSIT_SATS), 8)}`
                    : t("title")}
              </Button>
            </div>
          </motion.div>
        ) : (
          stage && (
            <motion.div
              key={`status-${step}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="flex flex-1 flex-col"
            >
              <FlowStepper step={stage} />

              {step === "success" ? (
                <Button className="mt-auto w-full" onClick={() => handleClose(false)}>
                  {tCommon("done")}
                </Button>
              ) : null}

              {step === "error" ? (
                <div className="mt-auto flex w-full gap-3">
                  <Button variant="outline" className="flex-1" onClick={() => handleClose(false)}>
                    {tCommon("close")}
                  </Button>
                  <Button className="flex-1" onClick={() => setStep("input")}>
                    {tCommon("tryAgain")}
                  </Button>
                </div>
              ) : null}
            </motion.div>
          )
        )}
      </AnimatePresence>
    </div>
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={handleClose}>
        <DrawerContent className="flex flex-col px-5 pb-5">
          <DrawerTitle className="sr-only">{t("title")}</DrawerTitle>
          {content}
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <AlertDialog open={open} onOpenChange={handleClose}>
      <AlertDialogContent className="flex flex-col sm:max-w-md">
        <AlertDialogTitle className="sr-only">{t("title")}</AlertDialogTitle>
        {content}
      </AlertDialogContent>
    </AlertDialog>
  );
}

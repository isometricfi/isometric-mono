"use client";

import { useDynamicContext } from "@dynamic-labs/sdk-react-core";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, CircleArrowUp, Loader2, XCircle } from "lucide-react";
import { useMemo, useState } from "react";
import { useMediaQuery } from "react-responsive";
import { AmountInput } from "@/components/options/AmountInput";
import { AlertDialog, AlertDialogContent } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Drawer, DrawerContent } from "@/components/ui/drawer";
import { useAccount, useConfig, useWithdraw } from "@/hooks";
import { formatBtc, formatBtcWithSymbol, parseBtcToSats } from "@/lib/utils";
import { Badge } from "../ui/badge";

type WithdrawStep = "input" | "signing" | "processing" | "success" | "error";

export function WithdrawModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const isMobile = useMediaQuery({ query: "(max-width: 768px)" });
  const { primaryWallet } = useDynamicContext();
  const { data: config } = useConfig();
  const { data: accountData } = useAccount();
  const withdraw = useWithdraw();

  const balance = accountData?.balance;
  const profile = accountData?.profile;
  const lockedSats = balance?.locked ?? BigInt(0);
  const availableSats = balance?.available ?? BigInt(0);
  const destinationAddress = profile?.address ?? primaryWallet?.address ?? "";

  const [step, setStep] = useState<WithdrawStep>("input");
  const [amountBtc, setAmountBtc] = useState("");
  const [error, setError] = useState<string | null>(null);

  const minWithdrawSats = config?.minWithdrawAmountSats ?? BigInt(50_000);

  const enteredAmountSats = useMemo(() => parseBtcToSats(amountBtc), [amountBtc]);
  const isBelowMinimum = enteredAmountSats < minWithdrawSats;

  const canWithdraw = useMemo(() => {
    const sats = parseBtcToSats(amountBtc);
    if (sats < minWithdrawSats) return false;
    if (sats > availableSats) return false;
    if (!destinationAddress) return false;
    return true;
  }, [amountBtc, minWithdrawSats, availableSats, destinationAddress]);

  const isProcessing = step === "signing" || step === "processing";

  const handleClose = (nextOpen: boolean) => {
    if (isProcessing) return;
    if (!nextOpen) {
      setStep("input");
      setAmountBtc("");
      setError(null);
    }
    onOpenChange(nextOpen);
  };

  const handleWithdraw = async () => {
    if (!canWithdraw) return;

    setError(null);
    setStep("signing");

    try {
      const amountSats = parseBtcToSats(amountBtc);

      setStep("processing");
      await withdraw.mutateAsync({
        btcAddress: destinationAddress,
        amountSats,
      });

      setStep("success");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to withdraw");
      setStep("error");
    }
  };

  const content = (
    <div className="space-y-6 md:pt-0 pt-4">
      <AnimatePresence mode="wait">
        {step === "input" && (
          <motion.div
            key="input"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-5"
          >
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-full bg-primary/10 flex items-center justify-center">
                <CircleArrowUp className="size-5 text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">Withdraw BTC</h2>
                <p className="text-sm text-muted-foreground">
                  Withdraw deposited BTC to your wallet
                </p>
              </div>
            </div>

            <div className="rounded-2xl border p-4 bg-card/50">
              <div className="text-xs text-muted-foreground mb-1">Destination</div>
              <div className="font-mono text-xs break-all">{destinationAddress}</div>
            </div>

            <AmountInput
              value={amountBtc}
              onChange={setAmountBtc}
              maxAmountSats={availableSats}
              minAmountSats={minWithdrawSats}
              onMaxClick={() => setAmountBtc(formatBtc(availableSats, 8))}
            />

            {lockedSats > BigInt(0) && (
              <Badge variant="secondary" className="w-full">
                {formatBtcWithSymbol(lockedSats, 8)} locked in active options
              </Badge>
            )}

            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => handleClose(false)}>
                Close
              </Button>
              <Button className="flex-1" onClick={handleWithdraw} disabled={!canWithdraw}>
                {isBelowMinimum ? `Min: ${formatBtcWithSymbol(minWithdrawSats, 8)}` : "Withdraw"}
              </Button>
            </div>
          </motion.div>
        )}

        {step === "signing" && (
          <motion.div
            key="signing"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex flex-col items-center justify-center py-12 space-y-4"
          >
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            >
              <Loader2 className="size-12 text-primary" />
            </motion.div>
            <div className="text-center">
              <h3 className="font-semibold">Sign message</h3>
              <p className="text-sm text-muted-foreground">Approve the withdrawal in your wallet</p>
            </div>
          </motion.div>
        )}

        {step === "processing" && (
          <motion.div
            key="processing"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex flex-col items-center justify-center py-12 space-y-4"
          >
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            >
              <Loader2 className="size-12 text-primary" />
            </motion.div>
            <div className="text-center">
              <h3 className="font-semibold">Processing withdrawal</h3>
              <p className="text-sm text-muted-foreground">This may take a moment...</p>
            </div>
          </motion.div>
        )}

        {step === "success" && (
          <motion.div
            key="success"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center justify-center space-y-4"
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
              <h3 className="text-xl font-semibold">Withdrawal submitted</h3>
              <p className="text-sm text-muted-foreground">Your BTC is on its way to your wallet</p>
            </div>

            <Button className="w-full mt-2" onClick={() => handleClose(false)}>
              Done
            </Button>
          </motion.div>
        )}

        {step === "error" && (
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
              <h3 className="text-xl font-semibold">Something went wrong</h3>
              <p className="text-sm text-destructive max-w-xs">{error}</p>
            </div>

            <div className="flex gap-3 w-full pt-2">
              <Button variant="outline" className="flex-1" onClick={() => handleClose(false)}>
                Close
              </Button>
              <Button className="flex-1" onClick={() => setStep("input")}>
                Try Again
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={handleClose} repositionInputs={false}>
        <DrawerContent className="px-5 pb-4">{content}</DrawerContent>
      </Drawer>
    );
  }

  return (
    <AlertDialog open={open} onOpenChange={handleClose}>
      <AlertDialogContent className="sm:max-w-md">{content}</AlertDialogContent>
    </AlertDialog>
  );
}

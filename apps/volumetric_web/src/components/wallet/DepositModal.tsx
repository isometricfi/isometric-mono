"use client";

import { isBitcoinWallet } from "@dynamic-labs/bitcoin";
import { useDynamicContext } from "@dynamic-labs/sdk-react-core";
import { AnimatePresence, motion } from "framer-motion";
import {
  CheckCircle2,
  CircleArrowDown,
  ClockCheck,
  ExternalLink,
  Loader2,
  ScanSearch,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import QRCodeSVG from "react-qr-code";
import { useMediaQuery } from "react-responsive";
import { AmountInput } from "@/components/options/AmountInput";
import { AlertDialog, AlertDialogContent, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import { Drawer, DrawerContent, DrawerTitle } from "@/components/ui/drawer";
import { useConfig, useDepositAddress, useSyncDeposit, useWalletBalance } from "@/hooks";
import {
  cn,
  DEFAULT_MIN_DEPOSIT_SATS,
  formatBtc,
  formatBtcWithSymbol,
  parseBtcToSatsBigint,
} from "@/lib/utils";
import { Badge } from "../ui/badge";
import { Skeleton } from "../ui/skeleton";

type DepositStep = "input" | "sending" | "waiting" | "success" | "error";
type DepositTab = "wallet" | "address";

export function DepositModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const isMobile = useMediaQuery({ query: "(max-width: 768px)" });
  const { primaryWallet } = useDynamicContext();
  const { data: config } = useConfig();
  const { data: walletBalanceSats } = useWalletBalance();
  const { data: depositAddressData, isLoading: isLoadingDepositAddress } = useDepositAddress();
  const syncDeposit = useSyncDeposit();

  const depositAddress = depositAddressData?.btcAddress ?? null;

  const [step, setStep] = useState<DepositStep>("input");
  const [tab, setTab] = useState<DepositTab>("wallet");
  const [amountBtc, setAmountBtc] = useState("");
  const [txid, setTxid] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const minDepositSats = BigInt(config?.minDepositAmountSats ?? DEFAULT_MIN_DEPOSIT_SATS);
  const isWalletReady = !!primaryWallet && isBitcoinWallet(primaryWallet);

  const enteredAmountSats = useMemo(() => {
    const sats = parseBtcToSatsBigint(amountBtc);
    console.log("[DepositModal] Parsed amount:", { amountBtc, sats: sats.toString() });
    return sats;
  }, [amountBtc]);

  const isBelowMinimum = enteredAmountSats < minDepositSats;

  const canDeposit = useMemo(() => {
    console.log("[DepositModal] canDeposit check:", {
      isWalletReady,
      depositAddress,
      amountBtc,
      walletBalanceSats,
      minDepositSats: minDepositSats.toString(),
    });

    if (!isWalletReady) return false;
    if (!depositAddress) return false;
    const sats = parseBtcToSatsBigint(amountBtc);
    if (walletBalanceSats !== null && walletBalanceSats !== undefined) {
      const walletBalanceBigInt = BigInt(Math.floor(walletBalanceSats));
      if (sats > walletBalanceBigInt) return false;
    }
    return sats >= minDepositSats;
  }, [isWalletReady, depositAddress, amountBtc, minDepositSats, walletBalanceSats]);

  const isProcessing = step === "sending" || step === "waiting";

  const handleClose = (nextOpen: boolean) => {
    if (isProcessing) return;
    if (!nextOpen) {
      setStep("input");
      setTab("wallet");
      setAmountBtc("");
      setTxid(null);
      setError(null);
    }
    onOpenChange(nextOpen);
  };

  const handleDeposit = async () => {
    if (!isWalletReady || !depositAddress) return;

    setError(null);
    setStep("sending");

    try {
      const amountSats = parseBtcToSatsBigint(amountBtc);
      const amountSatsNumber = Number(amountSats);

      console.log("[DepositModal] Sending deposit:", {
        amountBtc,
        amountSats: amountSats.toString(),
        amountSatsNumber,
        depositAddress,
      });

      const result = await primaryWallet.sendBitcoin({
        amount: amountSats,
        recipientAddress: depositAddress,
      });

      console.log("[DepositModal] Send result:", result);

      if (result) {
        setTxid(result);
        setStep("waiting");
      } else {
        throw new Error("Transaction was cancelled");
      }
    } catch (err) {
      console.error("[DepositModal] Send error:", err);
      setError(err instanceof Error ? err.message : "Failed to send");
      setStep("error");
    }
  };

  const _handleSyncDeposit = async () => {
    try {
      await syncDeposit.mutateAsync();
      setStep("success");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to sync deposit");
      setStep("error");
    }
  };

  const content = (
    <div className="space-y-6 md:pt-0 pt-3">
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
                <CircleArrowDown className="size-5 text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">Deposit BTC</h2>
                <p className="text-sm text-muted-foreground">
                  Deposit BTC to make and accept offers
                </p>
              </div>
            </div>

            <div className="flex gap-2 p-1 rounded-xl bg-muted/50">
              <button
                type="button"
                onClick={() => setTab("wallet")}
                className={cn(
                  "flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors",
                  tab === "wallet"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                Wallet
              </button>
              <button
                type="button"
                onClick={() => setTab("address")}
                className={cn(
                  "flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors",
                  tab === "address"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                Deposit Address
              </button>
            </div>

            {isLoadingDepositAddress ? (
              <div className=" space-y-4">
                <Skeleton className="w-full h-32 flex items-center justify-center gap-3">
                  Fetching deposit information...
                </Skeleton>
                <Skeleton className="w-full h-10" />
              </div>
            ) : depositAddress ? (
              <>
                {tab === "wallet" && (
                  <>
                    <AmountInput
                      value={amountBtc}
                      onChange={setAmountBtc}
                      maxAmountSats={walletBalanceSats ?? undefined}
                      minAmountSats={Number(minDepositSats)}
                      onMaxClick={
                        walletBalanceSats !== null && walletBalanceSats !== undefined
                          ? () => setAmountBtc(formatBtc(walletBalanceSats, 8))
                          : undefined
                      }
                    />
                    <div className="flex items-center gap-2">
                      <ClockCheck className="size-5" />
                      <p className="text-sm text-muted-foreground">Requires 6 confirmations</p>
                    </div>
                    <div className="flex gap-3">
                      <Button
                        variant="outline"
                        className="flex-1"
                        onClick={() => handleClose(false)}
                      >
                        Close
                      </Button>
                      <Button
                        className="flex-1"
                        onClick={() => {
                          console.log("[DepositModal] Deposit button clicked:", {
                            amountBtc,
                            canDeposit,
                            isBelowMinimum,
                          });
                          handleDeposit();
                        }}
                        disabled={!canDeposit}
                      >
                        {" "}
                        {isBelowMinimum
                          ? `Min: ${formatBtcWithSymbol(Number(minDepositSats), 8)}`
                          : "Deposit"}
                      </Button>
                    </div>
                  </>
                )}

                {tab === "address" && (
                  <>
                    <div className="flex flex-col items-center space-y-4">
                      <div className=" gap-4 flex w-full">
                        <QRCodeSVG value={depositAddress} size={80} />
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <ScanSearch className="size-5" />
                            <p className="text-sm text-muted-foreground">
                              We will automatically detect your deposit
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <ClockCheck className="size-5" />
                            <p className="text-sm text-muted-foreground">
                              Requires 6 confirmations
                            </p>
                          </div>
                          <Badge variant="destructive" className="w-full">
                            Minimum deposit: {formatBtcWithSymbol(Number(minDepositSats), 8)}
                          </Badge>
                        </div>
                      </div>

                      <div className="w-full rounded-2xl border p-4 bg-card/50">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-xs text-muted-foreground mb-1">
                              Deposit address
                            </div>
                            <div className="font-mono text-xs break-all select-all">
                              {depositAddress}
                            </div>
                          </div>
                          <CopyButton text={depositAddress} />
                        </div>
                      </div>
                    </div>
                    <Button variant="outline" className="w-full" onClick={() => handleClose(false)}>
                      Close
                    </Button>
                  </>
                )}
              </>
            ) : null}
          </motion.div>
        )}

        {step === "sending" && (
          <motion.div
            key="sending"
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
              <h3 className="font-semibold">Confirm in wallet</h3>
              <p className="text-sm text-muted-foreground">
                Approve the transaction in your wallet
              </p>
            </div>
          </motion.div>
        )}

        {step === "waiting" && (
          <motion.div
            key="waiting"
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
              <h3 className="text-xl font-semibold">Deposit initiated</h3>
              <p className="text-sm text-muted-foreground">
                Your deposit will be accounted in 6 blocks (~60min)
              </p>
            </div>

            {txid && (
              <div className="w-full rounded-2xl border p-4 bg-card/50">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-xs text-muted-foreground mb-1">Transaction ID</div>
                    <div className="font-mono text-xs break-all select-all">
                      {txid.slice(0, 8)}...{txid.slice(-8)}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <CopyButton text={txid} />

                    <Link
                      href={`https://mempool.space/testnet/tx/${txid}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Button variant="outline" size="icon" asChild>
                        <ExternalLink className="size-4" />
                      </Button>
                    </Link>
                  </div>
                </div>
              </div>
            )}

            <Button className="w-full mt-2" onClick={() => handleClose(false)}>
              Close
            </Button>
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
              <h3 className="text-xl font-semibold">Deposit complete</h3>
              <p className="text-sm text-muted-foreground">Your balance has been updated</p>
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
        <DrawerContent className="px-5 pb-5 ">
          <DrawerTitle className="sr-only">Deposit BTC</DrawerTitle>
          {content}
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <AlertDialog open={open} onOpenChange={handleClose}>
      <AlertDialogContent className="sm:max-w-md">
        <AlertDialogTitle className="sr-only">Deposit BTC</AlertDialogTitle>
        {content}
      </AlertDialogContent>
    </AlertDialog>
  );
}

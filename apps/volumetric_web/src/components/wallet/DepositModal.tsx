"use client";

import { isBitcoinWallet } from "@dynamic-labs/bitcoin";
import { useDynamicContext } from "@dynamic-labs/sdk-react-core";
import { AnimatePresence, motion } from "framer-motion";
import {
  CheckCircle2,
  CircleArrowDown,
  CircleArrowUp,
  ClockCheck,
  ExternalLink,
  FileSignature,
  ScanSearch,
  XCircle,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import QRCodeSVG from "react-qr-code";
import { useMediaQuery } from "react-responsive";
import { AnimatedToggle } from "@/components/navigation/AnimatedToggle";
import { AmountInput } from "@/components/options/AmountInput";
import { FlowStepper, type FlowStepperStep } from "@/components/options/MobileFlowParts";
import { AlertDialog, AlertDialogContent, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import { Drawer, DrawerContent, DrawerTitle } from "@/components/ui/drawer";
import {
  useAccount,
  useDepositAddress,
  useEstimatedFeeReserveSats,
  useWalletBalance,
} from "@/hooks";
import { Link } from "@/i18n/routing";
import { getNiceErrorMessage } from "@/lib/error-message";
import { formatBtc, formatBtcWithSymbol, parseBtcToSatsBigint } from "@/lib/utils";
import { Badge } from "../ui/badge";
import { Skeleton } from "../ui/skeleton";

const MIN_DEPOSIT_SATS = BigInt(2_000);
const MIN_WITHDRAW_SATS = BigInt(50_100);

type DepositStep = "input" | "sending" | "waiting" | "success" | "error";
type DepositTab = "wallet" | "address";

const WALLETS_WITHOUT_NATIVE_BTC_SEND = ["phantombtc"];

export function DepositModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const isMobile = useMediaQuery({ query: "(max-width: 768px)" });
  const { primaryWallet } = useDynamicContext();
  const { data: accountData } = useAccount();
  const { data: walletBalanceSats, isLoading: isLoadingWalletBalance } = useWalletBalance();
  const { data: feeReserveSats, isLoading: isLoadingFeeReserve } = useEstimatedFeeReserveSats();
  const { data: depositAddressData, isLoading: isLoadingDepositAddress } = useDepositAddress();
  const t = useTranslations("Deposit");
  const tCommon = useTranslations("Common");
  const mempoolBaseUrl = process.env.NEXT_PUBLIC_MEMPOOL_URL ?? "https://mempool.space";

  const depositAddress = depositAddressData?.btcAddress ?? null;

  const [step, setStep] = useState<DepositStep>("input");
  const [tab, setTab] = useState<DepositTab>("wallet");
  const [amountBtc, setAmountBtc] = useState("");
  const [txid, setTxid] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const existingBalanceSats =
    (accountData?.balance?.available ?? BigInt(0)) + (accountData?.balance?.locked ?? BigInt(0));
  const minDepositSats = MIN_DEPOSIT_SATS;
  const isWalletReady = !!primaryWallet && isBitcoinWallet(primaryWallet);
  const walletSupportsNativeSend =
    !primaryWallet || !WALLETS_WITHOUT_NATIVE_BTC_SEND.includes(primaryWallet.key);
  const effectiveTab: DepositTab = walletSupportsNativeSend ? tab : "address";

  const enteredAmountSats = useMemo(() => parseBtcToSatsBigint(amountBtc), [amountBtc]);

  const maxSpendableSats =
    walletBalanceSats == null
      ? undefined
      : Math.max(0, Math.floor(walletBalanceSats) - (feeReserveSats ?? 0) * 1.5);

  const isBelowMinimum = enteredAmountSats < minDepositSats;

  const showWithdrawHint = existingBalanceSats + enteredAmountSats < MIN_WITHDRAW_SATS;
  const recommendedDepositSats = MIN_WITHDRAW_SATS - existingBalanceSats;

  const canDeposit = useMemo(() => {
    if (!isWalletReady) return false;
    if (!depositAddress) return false;
    if (maxSpendableSats === undefined) return false;
    const sats = parseBtcToSatsBigint(amountBtc);
    if (sats > BigInt(maxSpendableSats)) return false;
    return sats >= minDepositSats;
  }, [isWalletReady, depositAddress, amountBtc, maxSpendableSats]);

  const isProcessing = step === "sending";

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
      const result = await primaryWallet.sendBitcoin({
        amount: amountSats,
        recipientAddress: depositAddress,
      });

      if (result) {
        setTxid(result);
        setStep("waiting");
      } else {
        setError(t("transactionCancelled"));
        setStep("error");
      }
    } catch (err) {
      setError(getNiceErrorMessage(err));
      setStep("error");
    }
  };

  const stages: Record<Exclude<DepositStep, "input">, FlowStepperStep> = {
    sending: {
      id: "sending",
      icon: FileSignature,
      tone: "progress",
      title: t("confirmInWallet"),
      description: t("approveTransaction"),
    },
    waiting: {
      id: "waiting",
      icon: CheckCircle2,
      tone: "success",
      title: t("depositInitiated"),
      description: t("depositInBlocks"),
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
    <div className="flex flex-col flex-1 md:pt-0 pt-3 min-h-[70vh] md:min-h-[400px]">
      <AnimatePresence mode="wait" initial={false}>
        {step === "input" && (
          <motion.div
            key="input"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex flex-col flex-1 space-y-5"
          >
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-full bg-primary/10 flex items-center justify-center">
                <CircleArrowDown className="size-5 text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">{t("title")}</h2>
                <p className="text-sm text-muted-foreground">{t("description")}</p>
              </div>
            </div>

            {walletSupportsNativeSend && (
              <AnimatedToggle
                layoutId="depositTab"
                className="w-full"
                options={[
                  { value: "wallet", label: t("wallet") },
                  { value: "address", label: t("depositAddress") },
                ]}
                value={tab}
                onChange={(v) => setTab(v as DepositTab)}
              />
            )}

            {isLoadingDepositAddress ? (
              <div className=" space-y-4">
                <Skeleton className="w-full h-32 flex items-center justify-center gap-3">
                  {t("fetchingInfo")}
                </Skeleton>
                <Skeleton className="w-full h-10" />
              </div>
            ) : depositAddress ? (
              <div className="flex flex-col flex-1">
                {effectiveTab === "wallet" && (
                  <div className="flex flex-col flex-1 gap-5">
                    {isLoadingWalletBalance || isLoadingFeeReserve ? (
                      <Skeleton className="w-full h-20" />
                    ) : (
                      <AmountInput
                        value={amountBtc}
                        onChange={setAmountBtc}
                        maxAmountSats={maxSpendableSats}
                        minAmountSats={Number(minDepositSats)}
                        onMaxClick={
                          maxSpendableSats !== undefined
                            ? () => setAmountBtc(formatBtc(maxSpendableSats, 8))
                            : undefined
                        }
                      />
                    )}
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <ClockCheck className="size-5" />
                        <p className="text-sm text-muted-foreground">
                          {t("requiresConfirmations")}
                        </p>
                      </div>
                      <div className="flex items-start gap-2">
                        <CircleArrowUp className="size-5 shrink-0" />
                        <div>
                          <p className="text-sm text-muted-foreground leading-tight">
                            {t("minWithdrawNote", {
                              amount: formatBtcWithSymbol(Number(MIN_WITHDRAW_SATS), 8),
                            })}
                          </p>
                        </div>
                      </div>
                      {showWithdrawHint && (
                        <p className="text-xs  leading-tight mt-1 px-2 py-2 bg-muted-foreground/10 rounded-md">
                          {t("recommendedDeposit", {
                            amount: formatBtcWithSymbol(Number(recommendedDepositSats), 8),
                          })}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-3 mt-auto">
                      <Button
                        variant="outline"
                        className="flex-1"
                        onClick={() => handleClose(false)}
                      >
                        {tCommon("close")}
                      </Button>
                      <Button className="flex-1" onClick={handleDeposit} disabled={!canDeposit}>
                        {isBelowMinimum
                          ? `${tCommon("min")}: ${formatBtcWithSymbol(Number(minDepositSats), 8)}`
                          : t("title")}
                      </Button>
                    </div>
                  </div>
                )}

                {effectiveTab === "address" && (
                  <div className="flex flex-col flex-1 gap-5">
                    <div className="flex flex-col items-center space-y-4">
                      <div className=" gap-4 md:flex w-full">
                        <div className="flex md:justify-start justify-center md:pb-0 pb-5">
                          <QRCodeSVG value={depositAddress} size={80} />
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <ScanSearch className="size-5 min-w-5" />
                            <p className="text-sm text-muted-foreground">{t("autoDetect")}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <ClockCheck className="size-5 min-w-5" />
                            <p className="text-sm text-muted-foreground">
                              {t("requiresConfirmations")}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <CircleArrowUp className="size-5 min-w-5" />
                            <p className="text-sm text-muted-foreground">
                              {t("minWithdrawNote", {
                                amount: formatBtcWithSymbol(Number(MIN_WITHDRAW_SATS), 8),
                              })}
                            </p>
                          </div>
                        </div>
                      </div>
                      <Badge variant="destructive" className="w-full text-xs">
                        {t("minDeposit", {
                          amount: formatBtcWithSymbol(Number(minDepositSats), 8),
                        })}
                      </Badge>
                      <div className="w-full rounded-xl border md:p-4 p-2 ">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-xs text-muted-foreground mb-1">
                              {t("depositAddressLabel")}
                            </div>
                            <div className="text-[11px] md:text-xs break-all select-all">
                              {depositAddress}
                            </div>
                          </div>
                          <CopyButton text={depositAddress} />
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      className="w-full mt-auto"
                      onClick={() => handleClose(false)}
                    >
                      {tCommon("close")}
                    </Button>
                  </div>
                )}
              </div>
            ) : null}
          </motion.div>
        )}

        {step !== "input" && stage && (
          <motion.div
            key={`status-${step}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="flex flex-col flex-1"
          >
            <FlowStepper step={stage} />

            {step === "waiting" && txid && (
              <div className="w-full rounded-lg border p-4 bg-card/50 mb-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-xs text-muted-foreground mb-1">{t("transactionId")}</div>
                    <div className="font-mono text-xs break-all select-all">
                      {txid.slice(0, 8)}...{txid.slice(-8)}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <CopyButton text={txid} />
                    <Button variant="outline" size="icon" asChild>
                      <Link
                        href={`${mempoolBaseUrl}/tx/${txid}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <ExternalLink className="size-4" />
                      </Link>
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {step === "waiting" && (
              <Button className="w-full mt-auto" onClick={() => handleClose(false)}>
                {tCommon("close")}
              </Button>
            )}

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
                <Button className="flex-1" onClick={() => setStep("input")}>
                  {tCommon("tryAgain")}
                </Button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={handleClose}>
        <DrawerContent className="px-5 pb-5 flex flex-col">
          <DrawerTitle className="sr-only">{t("title")}</DrawerTitle>
          {content}
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <AlertDialog open={open} onOpenChange={handleClose}>
      <AlertDialogContent className="sm:max-w-md flex flex-col">
        <AlertDialogTitle className="sr-only">{t("title")}</AlertDialogTitle>
        {content}
      </AlertDialogContent>
    </AlertDialog>
  );
}

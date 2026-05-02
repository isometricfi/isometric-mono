"use client";

import { useDynamicContext } from "@dynamic-labs/sdk-react-core";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  Check,
  CircleArrowDown,
  CircleArrowUp,
  History,
  LogOut,
  Settings,
  Sparkles,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useMediaQuery } from "react-responsive";
import { ShareSummaryModal } from "@/app/[locale]/history/_components/ShareSummaryModal";
import { SystemSettings } from "@/components/layout/SystemSettings";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Copyable } from "@/components/ui/copyable";
import { Drawer, DrawerContent, DrawerTitle } from "@/components/ui/drawer";
import { DepositModal } from "@/components/wallet/DepositModal";
import { PendingActivity } from "@/components/wallet/PendingActivity";
import { WithdrawModal } from "@/components/wallet/WithdrawModal";
import { useAccount, useModal, usePrices, useUpdateUsername } from "@/hooks";
import { Link } from "@/i18n/routing";
import { cn, formatBtcWithSymbolBigint, roundToN } from "@/lib/utils";
import { Badge } from "../ui/badge";

function shortenAddress(address: string) {
  if (address.length <= 14) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function AccountPanel({
  open,
  onOpenChange,
  onDisconnect,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDisconnect: () => void;
}) {
  const isMobile = useMediaQuery({ query: "(max-width: 768px)" });

  return (
    <Drawer
      repositionInputs={false}
      open={open}
      onOpenChange={onOpenChange}
      direction={isMobile ? "bottom" : "right"}
    >
      <DrawerContent
        className={cn(
          "flex flex-col",
          isMobile ? "px-4 pb-4 min-h-[95vh]" : "px-5 py-4 mt-4 mb-4 mr-0  rounded-l-xl ",
        )}
      >
        <DrawerTitle className="sr-only">Account</DrawerTitle>
        <AccountPanelContent onDisconnect={onDisconnect} onClose={() => onOpenChange(false)} />
      </DrawerContent>
    </Drawer>
  );
}

function AccountPanelContent({
  onDisconnect,
  onClose,
}: {
  onDisconnect: () => void;
  onClose: () => void;
}) {
  const { primaryWallet } = useDynamicContext();
  const { data: priceData } = usePrices();
  const { data: accountData, isLoading: isLoadingBalance } = useAccount();
  const updateUsername = useUpdateUsername();
  const t = useTranslations("AccountPanel");
  const tCommon = useTranslations("Common");
  const { openModal } = useModal();

  const [showSettings, setShowSettings] = useState(false);
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [usernameDraft, setUsernameDraft] = useState("");

  const profile = accountData?.profile;
  const balance = accountData?.balance;
  const deposited = balance?.total ?? BigInt(0);
  const available = balance?.available ?? BigInt(0);
  const referrals = profile?.referralCount ?? BigInt(0);

  const btcPrice = priceData?.btc ?? 0;
  const availableBtc = Number(available) / 100_000_000;
  const availableUsd = roundToN(availableBtc * btcPrice, 0);

  const connectedAddress = profile?.address ?? primaryWallet?.address ?? null;
  const addressLabel = connectedAddress ? shortenAddress(connectedAddress) : null;
  const displayName = profile?.username ?? tCommon("wallet");
  const avatarSeed = connectedAddress ?? displayName;

  return (
    <div className="flex flex-col gap-6 flex-1  ">
      <div className="flex justify-between gap-3 pt-2">
        <div className="flex items-center gap-3 min-w-0">
          <Avatar seed={avatarSeed} width={50} height={50} className="size-10 rounded-md" />
          <div className="min-w-0">
            <div className="font-semibold leading-none truncate">{displayName}</div>
            {connectedAddress ? (
              <Copyable
                text={connectedAddress}
                aria-label="Copy address"
                className="-ml-0.5 px-0.5 py-0.5 text-xs text-muted-foreground hover:text-foreground"
              >
                <span className="truncate">{addressLabel}</span>
              </Copyable>
            ) : (
              <div className="text-xs text-muted-foreground truncate">—</div>
            )}
          </div>
        </div>

        <Button
          variant="ghost"
          size="icon"
          onClick={() => {
            if (showSettings) {
              setShowSettings(false);
            } else {
              setUsernameDraft(profile?.username ?? "");
              setShowSettings(true);
            }
          }}
          aria-label={showSettings ? "Back" : "Settings"}
          className="-mt-1"
        >
          <AnimatePresence mode="wait" initial={false}>
            {showSettings ? (
              <motion.div
                key="back"
                initial={{ rotate: -90, filter: "blur(1px)" }}
                animate={{ rotate: 0, filter: "blur(0px)", scale: 1 }}
                exit={{ rotate: 90, filter: "blur(1px)" }}
                transition={{ duration: 0.3 }}
              >
                <ArrowLeft className="size-5" />
              </motion.div>
            ) : (
              <motion.div
                key="settings"
                initial={{ rotate: -90, opacity: 0 }}
                animate={{ rotate: 0, opacity: 1 }}
                exit={{ rotate: 90, opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                <Settings className="size-5" />
              </motion.div>
            )}
          </AnimatePresence>
        </Button>
      </div>

      <div className="relative flex-1 " style={{ perspective: "1000px" }}>
        <AnimatePresence initial={false}>
          {!showSettings ? (
            <motion.div
              key="main"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{
                scale: 1,
                opacity: 1,
                transition: {
                  delay: 0.2,
                  duration: 0.4,
                  ease: [0.32, 0.72, 0, 1],
                },
              }}
              exit={{
                scale: 0.9,
                opacity: 0,
                transition: { duration: 0.4, ease: [0.32, 0.72, 0, 1] },
              }}
              className="space-y-6"
            >
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">{t("available")}</p>
                <div className="flex items-center gap-2 justify-between">
                  <p className="text-3xl font-semibold tracking-tight">
                    {isLoadingBalance ? "—" : formatBtcWithSymbolBigint(available, 8)}
                  </p>
                  {!isLoadingBalance && availableUsd > 0 && (
                    <div className="text-muted-foreground text-sm bg-muted px-2 py-1 rounded-sm">
                      ${availableUsd.toLocaleString()}
                    </div>
                  )}
                </div>
                <Badge variant="secondary">
                  {t("deposited")} {formatBtcWithSymbolBigint(deposited, 8)}
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Button
                  className="flex flex-col items-start h-fit text-lg py-4 gap-2 pb-2 font-medium"
                  onClick={() => setShowDepositModal(true)}
                >
                  <CircleArrowDown className="size-6" />
                  <p>{t("deposit")}</p>
                </Button>
                <Button
                  className="flex flex-col items-start h-fit text-lg py-4 gap-2 pb-2 font-medium"
                  variant="secondary"
                  onClick={() => setShowWithdrawModal(true)}
                >
                  <CircleArrowUp className="size-6" />
                  <p>{t("withdraw")}</p>
                </Button>
              </div>
              <PendingActivity />
              <div className="space-y-5 md:absolute right-0 w-full">
                <Link href="/history" className="block w-full" onClick={onClose}>
                  <Button variant="outline" size="sm" className="w-full">
                    <History className="size-4 " /> {t("tradeHistory")}
                  </Button>
                </Link>
                <div className="flex items-center justify-between gap-3 rounded-lg border bg-muted/40 px-2 py-1.5">
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">{t("referred")}</p>
                    <p className="text-base font-semibold leading-tight">
                      {referrals.toLocaleString()}
                    </p>
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => openModal(<ShareSummaryModal />, false)}
                  >
                    <Sparkles className="size-3" />
                    {t("referralLink")}
                  </Button>
                </div>
              </div>
            </motion.div>
          ) : null}

          {showSettings ? (
            <motion.div
              key="settings"
              initial={{ y: 70, opacity: 0 }}
              animate={{
                y: 0,
                opacity: 1,
                transition: {
                  delay: 0.1,
                  duration: 0.5,
                  ease: [0.32, 0.72, 0, 1],
                },
              }}
              exit={{
                y: 70,
                opacity: 0,
                transition: { duration: 0.5, ease: [0.32, 0.72, 0, 1] },
              }}
              className="absolute inset-0 space-y-4  h-fit"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">{t("username")}</div>
                  <div className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded-sm">
                    {t("charactersRemaining", {
                      count: 16 - usernameDraft.length,
                    })}
                  </div>
                </div>
                <input
                  value={usernameDraft}
                  onChange={(e) => {
                    updateUsername.reset();
                    const value = e.target.value;
                    if (value.length <= 16) {
                      setUsernameDraft(value);
                    }
                  }}
                  placeholder={t("enterUsername")}
                  maxLength={16}
                  className="w-full py-3 px-4 bg-secondary/50 rounded-md text-sm font-medium placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              <Button
                onClick={() => updateUsername.mutate({ username: usernameDraft })}
                disabled={
                  updateUsername.isPending ||
                  usernameDraft.trim().length === 0 ||
                  updateUsername.isSuccess
                }
                className="w-full"
              >
                {updateUsername.isPending ? (
                  t("saving")
                ) : updateUsername.isSuccess ? (
                  <span className="flex items-center gap-2">
                    <Check className="size-4" />
                    {t("saved")}
                  </span>
                ) : (
                  t("save")
                )}
              </Button>

              {updateUsername.isError && !updateUsername.isSuccess && (
                <Badge variant="destructive" className="w-full">
                  {updateUsername.error.message}
                </Badge>
              )}

              <div className="pt-2">
                <SystemSettings />
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>

      {!showSettings && (
        <Button
          variant="outline"
          className="w-full mt-auto"
          onClick={onDisconnect}
          aria-label={t("disconnect")}
        >
          {t("disconnect")} <LogOut className="size-4" />
        </Button>
      )}

      <DepositModal open={showDepositModal} onOpenChange={setShowDepositModal} />

      <WithdrawModal open={showWithdrawModal} onOpenChange={setShowWithdrawModal} />
    </div>
  );
}

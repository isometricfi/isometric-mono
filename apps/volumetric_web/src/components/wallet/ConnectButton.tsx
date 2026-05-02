"use client";

import { useDynamicContext } from "@dynamic-labs/sdk-react-core";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useMediaQuery } from "react-responsive";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useAccount, useEnsureAccount, usePendingDeposits, usePendingWithdrawals } from "@/hooks";
import { AccountCreationModal } from "./AccountCreationModal";
import { AccountPanel } from "./AccountPanel";

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((word) => word[0])
    .filter(Boolean)
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function ConnectButton() {
  const { setShowAuthFlow, primaryWallet, handleLogOut } = useDynamicContext();
  const [open, setOpen] = useState(false);
  const ensureAccount = useEnsureAccount();
  const { data: accountData } = useAccount();
  const isMobile = useMediaQuery({ query: "(max-width: 768px)" });
  const t = useTranslations("ConnectButton");
  const { hasPending: hasPendingDeposits } = usePendingDeposits();
  const { hasPending: hasPendingWithdrawals } = usePendingWithdrawals();
  const hasPending = hasPendingDeposits || hasPendingWithdrawals;

  if (primaryWallet) {
    const address = primaryWallet.address;
    const shortAddress = `${address.slice(0, 3)}...${address.slice(-3)}`;
    const username = accountData?.profile?.username ?? null;
    const displayName = username ? (isMobile ? getInitials(username) : username) : shortAddress;
    const seed = accountData?.profile?.address ?? address;
    return (
      <>
        <Button
          variant="outline"
          onClick={() => setOpen(true)}
          className="gap-2 pl-1.5 pr-3 relative overflow-hidden"
        >
          {hasPending && (
            <span className="pointer-events-none absolute inset-0 animate-shimmer bg-gradient-to-r from-transparent via-card-foreground/10 to-transparent" />
          )}
          <Avatar seed={seed} width={24} height={24} className="size-6 rounded-sm" />
          <span className="max-w-[10rem] truncate">{displayName}</span>
        </Button>
        <AccountPanel
          open={open}
          onOpenChange={setOpen}
          onDisconnect={() => {
            setOpen(false);
            handleLogOut();
          }}
        />
        <AccountCreationModal
          open={ensureAccount.isOpen}
          step={ensureAccount.step}
          error={ensureAccount.error}
          onClose={ensureAccount.close}
        />
      </>
    );
  }

  return <Button onClick={() => setShowAuthFlow(true)}>{t("connect")}</Button>;
}

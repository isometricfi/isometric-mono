"use client";

import { useState } from "react";
import { useMediaQuery } from "react-responsive";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useAccount, useBtcAddress, usePendingDeposits, usePendingWithdrawals } from "@/hooks";
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
  const [open, setOpen] = useState(false);
  const { data: accountData } = useAccount();
  const demoAddress = useBtcAddress("payment");
  const isMobile = useMediaQuery({ query: "(max-width: 768px)" });
  const { hasPending: hasPendingDeposits } = usePendingDeposits();
  const { hasPending: hasPendingWithdrawals } = usePendingWithdrawals();
  const hasPending = hasPendingDeposits || hasPendingWithdrawals;

  const address = accountData?.profile?.address ?? demoAddress;
  const shortAddress =
    address.length <= 14 ? address : `${address.slice(0, 4)}...${address.slice(-3)}`;
  const username = accountData?.profile?.username ?? null;
  const displayName = username ? (isMobile ? getInitials(username) : username) : shortAddress;

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
        <Avatar seed={address} width={24} height={24} className="size-6 rounded-sm" />
        <span className="max-w-[10rem] truncate">{displayName}</span>
      </Button>
      <AccountPanel open={open} onOpenChange={setOpen} />
    </>
  );
}

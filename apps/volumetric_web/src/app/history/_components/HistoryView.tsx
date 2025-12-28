"use client";

import { useDynamicContext } from "@dynamic-labs/sdk-react-core";
import { ConnectButton } from "@/components/wallet/ConnectButton";
import { useAccount } from "@/hooks";
import { HistoryTable } from "./HistoryTable";

export function HistoryView() {
  const { primaryWallet } = useDynamicContext();
  const { data: account, isFetched } = useAccount();

  if (!primaryWallet) {
    return (
      <div className="flex flex-col items-center justify-center gap-4">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold">History</h1>
        </div>
        <p className="text-muted-foreground">Connect your wallet to view your trading history</p>
        <ConnectButton />
      </div>
    );
  }

  if (isFetched && !account?.profile) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <p className="text-muted-foreground">Create an account to access your trading history</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 items-center">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold">Trading history</h1>
      </div>
      <HistoryTable />
    </div>
  );
}

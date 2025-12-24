"use client";

import { useDynamicContext } from "@dynamic-labs/sdk-react-core";
import { PencilLine, Zap } from "lucide-react";
import { useState } from "react";
import { AnimatedToggle } from "@/components/navigation/AnimatedToggle";
import { ConnectButton } from "@/components/wallet/ConnectButton";
import { useAccount } from "@/hooks";
import { OffersTable } from "./OffersTable";
import { OptionsTable } from "./OptionsTable";

type TabValue = "offers" | "options";

export function PortfolioView() {
  const { primaryWallet } = useDynamicContext();
  const { data: account, isFetched } = useAccount();
  const [activeTab, setActiveTab] = useState<TabValue>("offers");

  if (!primaryWallet) {
    return (
      <div className="flex flex-col items-center justify-center gap-4">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold">Portfolio</h1>
        </div>
        <p className="text-muted-foreground">Connect your wallet to view your portfolio</p>
        <ConnectButton />
      </div>
    );
  }

  if (isFetched && !account?.profile) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <p className="text-muted-foreground">Create an account to access your portfolio</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold">Portfolio</h1>
      </div>

      <div className="flex flex-col gap-7">
        <div className="flex justify-center">
          <AnimatedToggle
            options={[
              { value: "offers", label: "Offers", icon: PencilLine },
              { value: "options", label: "Options", icon: Zap },
            ]}
            value={activeTab}
            onChange={setActiveTab}
            layoutId="portfolioTab"
          />
        </div>

        {activeTab === "options" && <OptionsTable />}
        {activeTab === "offers" && <OffersTable />}
      </div>
    </div>
  );
}

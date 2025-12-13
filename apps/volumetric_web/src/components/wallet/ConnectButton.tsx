"use client";

import { useDynamicContext } from "@dynamic-labs/sdk-react-core";
import { Button } from "@/components/ui/button";

export function ConnectButton() {
  const { setShowAuthFlow, primaryWallet, handleLogOut } = useDynamicContext();

  if (primaryWallet) {
    const address = primaryWallet.address;
    const shortAddress = `${address.slice(0, 6)}...${address.slice(-4)}`;
    return (
      <Button variant="outline" onClick={() => handleLogOut()}>
        {shortAddress}
      </Button>
    );
  }

  return <Button onClick={() => setShowAuthFlow(true)}>Connect</Button>;
}

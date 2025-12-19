"use client";

import { BitcoinWalletConnectors } from "@dynamic-labs/bitcoin";
import { DynamicContextProvider } from "@dynamic-labs/sdk-react-core";
import { createContext, useContext } from "react";

const environmentId = process.env.NEXT_PUBLIC_DYNAMIC_ENVIRONMENT_ID;

const DynamicConfigContext = createContext({ isConfigured: false });

export function useDynamicConfig() {
  return useContext(DynamicConfigContext);
}

export function DynamicProvider({ children }: { children: React.ReactNode }) {
  const isConfigured = Boolean(environmentId);

  if (!isConfigured) {
    console.error(
      "[DynamicProvider] NEXT_PUBLIC_DYNAMIC_ENVIRONMENT_ID is missing. Wallet features will be disabled.",
    );
  }

  return (
    <DynamicConfigContext.Provider value={{ isConfigured }}>
      <DynamicContextProvider
        settings={{
          environmentId: environmentId || "00000000-0000-0000-0000-000000000000",
          walletConnectors: [BitcoinWalletConnectors],
          initialAuthenticationMode: "connect-and-sign",
        }}
      >
        {children}
      </DynamicContextProvider>
    </DynamicConfigContext.Provider>
  );
}

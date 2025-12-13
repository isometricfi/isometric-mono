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
  if (!environmentId) {
    return (
      <DynamicConfigContext.Provider value={{ isConfigured: false }}>
        {children}
      </DynamicConfigContext.Provider>
    );
  }

  return (
    <DynamicConfigContext.Provider value={{ isConfigured: true }}>
      <DynamicContextProvider
        settings={{
          environmentId,
          walletConnectors: [BitcoinWalletConnectors],
          initialAuthenticationMode: "connect-and-sign",
        }}
      >
        {children}
      </DynamicContextProvider>
    </DynamicConfigContext.Provider>
  );
}

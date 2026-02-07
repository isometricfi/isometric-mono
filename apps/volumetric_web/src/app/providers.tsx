"use client";

import { isServer, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Agentation } from "agentation";
import { ModalProvider } from "@/components/layout/ModalProvider";
import { Toaster } from "@/components/ui/sonner";
import { TRPCProvider, trpcClient } from "@/trpc/react";
import { DynamicProvider } from "./providers/dynamic-provider";

const AGENTATION_ENDPOINT = "http://localhost:4747";

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000,
      },
    },
  });
}

let browserQueryClient: QueryClient | undefined;

function getQueryClient() {
  if (isServer) {
    return makeQueryClient();
  } else {
    if (!browserQueryClient) browserQueryClient = makeQueryClient();
    return browserQueryClient;
  }
}

export default function Providers({ children }: { children: React.ReactNode }) {
  const queryClient = getQueryClient();

  return (
    <QueryClientProvider client={queryClient}>
      <TRPCProvider trpcClient={trpcClient} queryClient={queryClient}>
        <Toaster position="top-center" />
        <DynamicProvider>
          {children}
          <ModalProvider />
          {process.env.NODE_ENV === "development" && <Agentation endpoint={AGENTATION_ENDPOINT} />}
        </DynamicProvider>
      </TRPCProvider>
    </QueryClientProvider>
  );
}

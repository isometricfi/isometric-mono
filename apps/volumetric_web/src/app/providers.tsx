"use client";

import { Toaster } from "@/components/ui/sonner";
import { TRPCProvider } from "@/providers/trpc-provider";
import { DynamicProvider } from "./providers/dynamic-provider";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <TRPCProvider>
      <Toaster position="top-center" />
      <DynamicProvider>{children}</DynamicProvider>
    </TRPCProvider>
  );
}

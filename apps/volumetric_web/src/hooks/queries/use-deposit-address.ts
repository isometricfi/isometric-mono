"use client";

import { useDynamicContext } from "@dynamic-labs/sdk-react-core";
import { trpc } from "@/lib/trpc";
import { useBtcAddress } from "./use-btc-address";

export function useDepositAddress() {
  const { primaryWallet } = useDynamicContext();
  const address = useBtcAddress("payment");

  return trpc.account.getDepositAddress.useQuery(
    { address: address ?? "" },
    {
      enabled: !!primaryWallet && !!address,
      staleTime: 300_000,
    },
  );
}

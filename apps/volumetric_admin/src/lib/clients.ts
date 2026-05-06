import type { ActorSubclass } from "@icp-sdk/core/agent";
import type { _SERVICE as VolumetricService } from "@volumetric/canister-types";
import { useMemo } from "react";
import type { LedgerAccount } from "./account";
import {
  type AccountTransactionsPage,
  createCkBtcIndexClient,
  getAccountTransactionsPage,
  getAllAccountTransactions,
} from "./ckbtc-index";
import { createCkBtcLedgerClient } from "./ckbtc-ledger";
import { useConnection } from "./connection-context";
import { getWhitelistedIdentity } from "./identity";
import { createVolumetricClient } from "./volumetric";

export type CanisterClients = {
  volumetric: ActorSubclass<VolumetricService>;
  ckBtcIndex: ReturnType<typeof createCkBtcIndexClient>;
  ckBtcLedger: ReturnType<typeof createCkBtcLedgerClient>;
};

export function useCreateCanisterClients(): () => CanisterClients {
  const { icHost, volumetricCanisterId, ckBtcIndexCanisterId, ckBtcLedgerCanisterId } =
    useConnection();

  return useMemo(() => {
    return () => {
      const identity = getWhitelistedIdentity();
      return {
        volumetric: createVolumetricClient({
          canisterId: volumetricCanisterId,
          host: icHost,
          identity,
        }),
        ckBtcIndex: createCkBtcIndexClient({
          canisterId: ckBtcIndexCanisterId,
          host: icHost,
          identity,
        }),
        ckBtcLedger: createCkBtcLedgerClient({
          canisterId: ckBtcLedgerCanisterId,
          host: icHost,
          identity,
        }),
      };
    };
  }, [icHost, volumetricCanisterId, ckBtcIndexCanisterId, ckBtcLedgerCanisterId]);
}

export type { AccountTransactionsPage, LedgerAccount };
export { getAccountTransactionsPage, getAllAccountTransactions };

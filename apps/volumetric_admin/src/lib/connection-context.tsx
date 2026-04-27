import { createContext, type ReactNode, useContext, useMemo, useState } from "react";
import {
  DEFAULT_CKBTC_INDEX_CANISTER_ID,
  DEFAULT_CKBTC_LEDGER_CANISTER_ID,
  DEFAULT_IC_HOST,
  DEFAULT_KNOWN_PROTOCOL_CANISTER_IDS,
  DEFAULT_VOLUMETRIC_CANISTER_ID,
} from "./constants";

export type ConnectionState = {
  icHost: string;
  volumetricCanisterId: string;
  ckBtcIndexCanisterId: string;
  ckBtcLedgerCanisterId: string;
  knownProtocolCanisterIds: string;
};

export type ConnectionContextValue = ConnectionState & {
  setIcHost: (value: string) => void;
  setVolumetricCanisterId: (value: string) => void;
  setCkBtcIndexCanisterId: (value: string) => void;
  setCkBtcLedgerCanisterId: (value: string) => void;
  setKnownProtocolCanisterIds: (value: string) => void;
  knownProtocolCanisterIdList: string[];
};

const ConnectionContext = createContext<ConnectionContextValue | null>(null);

export function ConnectionProvider({ children }: { children: ReactNode }) {
  const [icHost, setIcHost] = useState(DEFAULT_IC_HOST);
  const [volumetricCanisterId, setVolumetricCanisterId] = useState(DEFAULT_VOLUMETRIC_CANISTER_ID);
  const [ckBtcIndexCanisterId, setCkBtcIndexCanisterId] = useState(DEFAULT_CKBTC_INDEX_CANISTER_ID);
  const [ckBtcLedgerCanisterId, setCkBtcLedgerCanisterId] = useState(
    DEFAULT_CKBTC_LEDGER_CANISTER_ID,
  );
  const [knownProtocolCanisterIds, setKnownProtocolCanisterIds] = useState(
    DEFAULT_KNOWN_PROTOCOL_CANISTER_IDS.join("\n"),
  );

  const knownProtocolCanisterIdList = useMemo(
    () =>
      knownProtocolCanisterIds
        .split(/\s+/)
        .map((canisterId) => canisterId.trim())
        .filter(Boolean),
    [knownProtocolCanisterIds],
  );

  const value: ConnectionContextValue = {
    icHost,
    volumetricCanisterId,
    ckBtcIndexCanisterId,
    ckBtcLedgerCanisterId,
    knownProtocolCanisterIds,
    knownProtocolCanisterIdList,
    setIcHost,
    setVolumetricCanisterId,
    setCkBtcIndexCanisterId,
    setCkBtcLedgerCanisterId,
    setKnownProtocolCanisterIds,
  };

  return <ConnectionContext.Provider value={value}>{children}</ConnectionContext.Provider>;
}

export function useConnection(): ConnectionContextValue {
  const context = useContext(ConnectionContext);
  if (!context) {
    throw new Error("useConnection must be used inside ConnectionProvider");
  }
  return context;
}

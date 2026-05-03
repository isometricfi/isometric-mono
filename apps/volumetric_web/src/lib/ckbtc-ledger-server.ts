import { Actor } from "@dfinity/agent";
import type { IDL } from "@dfinity/candid";
import { getSharedAgent } from "./canister-server";

export interface CkbtcLedgerService {
  icrc1_fee: () => Promise<bigint>;
}

const ckbtcLedgerIdl: IDL.InterfaceFactory = ({ IDL: idl }) => {
  return idl.Service({
    icrc1_fee: idl.Func([], [idl.Nat], ["query"]),
  });
};

let cachedActor: CkbtcLedgerService | null = null;

export async function getCkbtcLedgerActor(): Promise<CkbtcLedgerService> {
  if (cachedActor) {
    return cachedActor;
  }

  const canisterId = process.env.CKBTC_LEDGER_CANISTER_ID;
  if (!canisterId) {
    throw new Error("CKBTC_LEDGER_CANISTER_ID environment variable is not set");
  }

  const agent = await getSharedAgent();
  cachedActor = Actor.createActor<CkbtcLedgerService>(ckbtcLedgerIdl, {
    agent,
    canisterId,
  });

  return cachedActor;
}

import { Actor } from "@dfinity/agent";
import type { IDL } from "@dfinity/candid";
import { getSharedAgent } from "./canister-server";

export type RetrieveBtcStatusV2 =
  | { Signing: null }
  | { Confirmed: { txid: Uint8Array | number[] } }
  | { Sending: { txid: Uint8Array | number[] } }
  | { Submitted: { txid: Uint8Array | number[] } }
  | { Pending: null }
  | { Unknown: null }
  | { AmountTooLow: null }
  | { WillReimburse: unknown }
  | { Reimbursed: unknown };

export interface CkbtcMinterService {
  retrieve_btc_status_v2: (arg: { block_index: bigint }) => Promise<RetrieveBtcStatusV2>;
}

const ckbtcMinterIdl: IDL.InterfaceFactory = ({ IDL: idl }) => {
  const TxidBlob = idl.Vec(idl.Nat8);
  const ReimbursementReason = idl.Variant({
    CallFailed: idl.Null,
    TaintedDestination: idl.Record({
      kyt_provider: idl.Principal,
      kyt_fee: idl.Nat64,
    }),
  });
  const Account = idl.Record({
    owner: idl.Principal,
    subaccount: idl.Opt(idl.Vec(idl.Nat8)),
  });
  const ReimbursementRequest = idl.Record({
    account: Account,
    amount: idl.Nat64,
    reason: ReimbursementReason,
  });
  const ReimbursedDeposit = idl.Record({
    account: Account,
    mint_block_index: idl.Nat64,
    amount: idl.Nat64,
    reason: ReimbursementReason,
  });
  const RetrieveBtcStatusV2 = idl.Variant({
    Signing: idl.Null,
    Confirmed: idl.Record({ txid: TxidBlob }),
    Sending: idl.Record({ txid: TxidBlob }),
    AmountTooLow: idl.Null,
    WillReimburse: ReimbursementRequest,
    Unknown: idl.Null,
    Submitted: idl.Record({ txid: TxidBlob }),
    Reimbursed: ReimbursedDeposit,
    Pending: idl.Null,
  });
  return idl.Service({
    retrieve_btc_status_v2: idl.Func(
      [idl.Record({ block_index: idl.Nat64 })],
      [RetrieveBtcStatusV2],
      ["query"],
    ),
  });
};

let cachedActor: CkbtcMinterService | null = null;

export async function getCkbtcMinterActor(): Promise<CkbtcMinterService> {
  if (cachedActor) {
    return cachedActor;
  }

  const canisterId = process.env.CKBTC_MINTER_CANISTER_ID;
  if (!canisterId) {
    throw new Error("CKBTC_MINTER_CANISTER_ID environment variable is not set");
  }

  const agent = await getSharedAgent();
  cachedActor = Actor.createActor<CkbtcMinterService>(ckbtcMinterIdl, {
    agent,
    canisterId,
  });

  return cachedActor;
}

export function bytesToHex(bytes: Uint8Array | number[]): string {
  const arr = bytes instanceof Uint8Array ? bytes : Uint8Array.from(bytes);
  return Array.from(arr)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function bitcoinTxidBlobToExplorerHex(bytes: Uint8Array | number[]): string {
  const arr = bytes instanceof Uint8Array ? bytes : Uint8Array.from(bytes);
  const reversed = new Uint8Array(arr.length);
  for (let i = 0; i < arr.length; i += 1) {
    reversed[i] = arr[arr.length - 1 - i]!;
  }
  return bytesToHex(reversed);
}

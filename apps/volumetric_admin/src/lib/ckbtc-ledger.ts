import { Actor, type ActorSubclass, HttpAgent, type Identity } from "@icp-sdk/core/agent";
import { IDL } from "@icp-sdk/core/candid";

import type { LedgerAccount } from "./account";

type CkBtcLedgerService = {
  icrc1_balance_of: (account: LedgerAccount) => Promise<bigint>;
  icrc1_fee: () => Promise<bigint>;
};

export function createCkBtcLedgerClient({
  canisterId,
  host,
  identity,
}: {
  canisterId: string;
  host: string;
  identity?: Identity;
}): ActorSubclass<CkBtcLedgerService> {
  const agent = new HttpAgent({ host, identity });
  return Actor.createActor<CkBtcLedgerService>(ckBtcLedgerIdlFactory, {
    agent,
    canisterId,
  });
}

const accountIdl = IDL.Record({
  owner: IDL.Principal,
  subaccount: IDL.Opt(IDL.Vec(IDL.Nat8)),
});

const ckBtcLedgerIdlFactory: IDL.InterfaceFactory = ({ IDL }) =>
  IDL.Service({
    icrc1_balance_of: IDL.Func([accountIdl], [IDL.Nat], ["query"]),
    icrc1_fee: IDL.Func([], [IDL.Nat], ["query"]),
  });

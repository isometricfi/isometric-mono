import type { Principal } from "@icp-sdk/core/principal";

const SUBACCOUNT_LENGTH_BYTES = 32;

export type LedgerAccount = {
  owner: Principal;
  subaccount: [] | [Uint8Array | number[]];
};

export function defaultAccount(owner: Principal): LedgerAccount {
  return { owner, subaccount: [] };
}

export function deriveSubaccount(principal: Principal): Uint8Array {
  const principalBytes = principal.toUint8Array();
  const subaccount = new Uint8Array(SUBACCOUNT_LENGTH_BYTES);
  subaccount.set(principalBytes);
  return subaccount;
}

export function accountKey(account: LedgerAccount): string {
  const subaccount = account.subaccount[0];
  if (!subaccount) {
    return `${account.owner.toText()}:default`;
  }

  return `${account.owner.toText()}:${Array.from(subaccount)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")}`;
}

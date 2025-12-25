import type { DepositInfo } from "@volumetric/canister-types";
import type { Output } from "./schema";

export function mapResult(data: DepositInfo): Output {
  return {
    btcAddress: data.btc_address,
    account: {
      owner: data.account.owner.toText(),
      subaccount: data.account.subaccount[0] ? Array.from(data.account.subaccount[0]) : null,
    },
  };
}

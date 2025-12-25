import type { DepositInfo } from "@volumetric/canister-types";
import type { DepositAddressResponse } from "./types";

export const mapDepositAddress = (data: DepositInfo): DepositAddressResponse => ({
  btcAddress: data.btc_address,
  account: {
    owner: data.account.owner.toText(),
    subaccount: data.account.subaccount[0] ? Array.from(data.account.subaccount[0]) : null,
  },
});

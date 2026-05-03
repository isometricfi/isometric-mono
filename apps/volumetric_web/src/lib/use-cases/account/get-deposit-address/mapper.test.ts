import { Principal } from "@icp-sdk/core/principal";
import type { DepositInfo } from "@volumetric/canister-types";
import { describe, expect, test } from "vitest";
import { mapResult } from "./mapper";

const DEFAULT_PRINCIPAL = Principal.fromText("aaaaa-aa");
const DEFAULT_BTC_ADDRESS = "bc1qdeposit";
const DEFAULT_SUBACCOUNT = new Uint8Array([0, 0, 0, 1]);

describe("mapResult (get-deposit-address)", () => {
  test("should map all fields with subaccount present", () => {
    // given
    const input: DepositInfo = {
      btc_address: DEFAULT_BTC_ADDRESS,
      account: { owner: DEFAULT_PRINCIPAL, subaccount: [DEFAULT_SUBACCOUNT] },
    };

    // when
    const result = mapResult(input);

    // then
    expect(result).toEqual({
      btcAddress: DEFAULT_BTC_ADDRESS,
      account: {
        owner: DEFAULT_PRINCIPAL.toText(),
        subaccount: [0, 0, 0, 1],
      },
    });
  });

  test("should return null subaccount when absent", () => {
    // given
    const input: DepositInfo = {
      btc_address: DEFAULT_BTC_ADDRESS,
      account: { owner: DEFAULT_PRINCIPAL, subaccount: [] },
    };

    // when
    const result = mapResult(input);

    // then
    expect(result.account.subaccount).toBeNull();
  });
});

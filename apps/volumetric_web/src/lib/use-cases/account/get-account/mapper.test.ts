import { Principal } from "@dfinity/principal";
import type { ProfileInfo, UserBalanceInfo } from "@volumetric/canister-types";
import { describe, expect, test } from "vitest";
import { mapBalance, mapProfile } from "./mapper";

const DEFAULT_PRINCIPAL = Principal.fromText("aaaaa-aa");
const DEFAULT_ADDRESS = "bc1qexampleaddress";
const DEFAULT_SUBACCOUNT = new Uint8Array([0, 0, 0, 1]);

function makeProfileInfo(overrides: Partial<ProfileInfo> = {}): ProfileInfo {
  return {
    principal: DEFAULT_PRINCIPAL,
    username: ["testuser"],
    subaccount: DEFAULT_SUBACCOUNT,
    address: DEFAULT_ADDRESS,
    ...overrides,
  };
}

describe("mapProfile", () => {
  test("should map all profile fields", () => {
    // given
    const profile = makeProfileInfo();

    // when
    const result = mapProfile(profile);

    // then
    expect(result).toEqual({
      address: DEFAULT_ADDRESS,
      username: "testuser",
      principal: DEFAULT_PRINCIPAL.toString(),
    });
  });

  test("should return null username when array is empty", () => {
    // given
    const profile = makeProfileInfo({ username: [] });

    // when
    const result = mapProfile(profile);

    // then
    expect(result.username).toBeNull();
  });
});

describe("mapBalance", () => {
  test("should map all balance fields", () => {
    // given
    const TOTAL = BigInt(500_000);
    const AVAILABLE = BigInt(300_000);
    const LOCKED = BigInt(200_000);
    const input: UserBalanceInfo = {
      total: TOTAL,
      available: AVAILABLE,
      locked: LOCKED,
    };

    // when
    const result = mapBalance(input);

    // then
    expect(result).toEqual({
      total: TOTAL,
      available: AVAILABLE,
      locked: LOCKED,
    });
  });
});

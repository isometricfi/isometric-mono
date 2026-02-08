import { Principal } from "@dfinity/principal";
import type { ProfileInfo } from "@volumetric/canister-types";
import { describe, expect, test } from "vitest";
import { mapResult } from "./mapper";

const DEFAULT_PRINCIPAL = Principal.fromText("aaaaa-aa");
const DEFAULT_ADDRESS = "bc1qexampleaddress";
const DEFAULT_SUBACCOUNT = new Uint8Array([0, 0, 0, 1]);

function makeProfileInfo(overrides: Partial<ProfileInfo> = {}): ProfileInfo {
  return {
    principal: DEFAULT_PRINCIPAL,
    username: ["newuser"],
    subaccount: DEFAULT_SUBACCOUNT,
    address: DEFAULT_ADDRESS,
    ...overrides,
  };
}

describe("mapResult (create-account)", () => {
  test("should map all profile fields", () => {
    // given
    const profile = makeProfileInfo();

    // when
    const result = mapResult(profile);

    // then
    expect(result).toEqual({
      principal: DEFAULT_PRINCIPAL.toText(),
      subaccount: [0, 0, 0, 1],
      address: DEFAULT_ADDRESS,
      username: "newuser",
    });
  });

  test("should return null username when absent", () => {
    // given
    const profile = makeProfileInfo({ username: [] });

    // when
    const result = mapResult(profile);

    // then
    expect(result.username).toBeNull();
  });
});

import { describe, expect, test, vi } from "vitest";
import { validateInviteCode } from "./validate-invite-code";

describe("validateInviteCode", () => {
  test("should skip validation when no invite code is present", async () => {
    // given
    const canister = {
      validate_invite_code: vi.fn(),
    };

    // when
    await validateInviteCode(canister as never, undefined, "bc1qexampleaddress");

    // then
    expect(canister.validate_invite_code).not.toHaveBeenCalled();
  });

  test("should throw when the canister rejects the invite code", async () => {
    // given
    const canister = {
      validate_invite_code: vi.fn().mockResolvedValue(false),
    };

    // when
    const result = validateInviteCode(canister as never, "ABC123", "bc1qexampleaddress");

    // then
    await expect(result).rejects.toThrow("Invalid invite code");
    expect(canister.validate_invite_code).toHaveBeenCalledWith("ABC123", "bc1qexampleaddress");
  });

  test("should resolve when the canister accepts the invite code", async () => {
    // given
    const canister = {
      validate_invite_code: vi.fn().mockResolvedValue(true),
    };

    // when
    await validateInviteCode(canister as never, "ABC123", "bc1qexampleaddress");

    // then
    expect(canister.validate_invite_code).toHaveBeenCalledWith("ABC123", "bc1qexampleaddress");
  });
});

import { describe, expect, test } from "vitest";
import { normalizeInviteCode } from "./invite-code";

describe("normalizeInviteCode", () => {
  test("should uppercase and trim a valid invite code", () => {
    // given
    const rawInviteCode = "  ab12cd ";

    // when
    const result = normalizeInviteCode(rawInviteCode);

    // then
    expect(result).toBe("AB12CD");
  });

  test("should return null for an invalid invite code", () => {
    // given
    const rawInviteCode = "too-long";

    // when
    const result = normalizeInviteCode(rawInviteCode);

    // then
    expect(result).toBeNull();
  });
});

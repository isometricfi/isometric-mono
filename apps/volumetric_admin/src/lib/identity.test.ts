import { describe, expect, test } from "vitest";

import { hexToBytes } from "./identity";

describe("identity helpers", () => {
  test("should convert hex encoded private keys to bytes", () => {
    // given
    const privateKeyHex = "000102ff";

    // when
    const bytes = hexToBytes(privateKeyHex);

    // then
    expect(Array.from(bytes)).toEqual([0, 1, 2, 255]);
  });

  test("should reject malformed hex byte strings", () => {
    // given
    const privateKeyHex = "abc";

    // when
    const parsePrivateKey = () => hexToBytes(privateKeyHex);

    // then
    expect(parsePrivateKey).toThrow("even number");
  });
});

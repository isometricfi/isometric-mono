import { describe, expect, test } from "vitest";
import { bitcoinTxidBlobToExplorerHex, bytesToHex } from "./ckbtc-minter-server";

function hexToBytes(hex: string): Uint8Array {
  const pairs = hex.match(/.{1,2}/g);
  if (!pairs || pairs.length * 2 !== hex.length) {
    throw new Error("invalid hex");
  }
  return Uint8Array.from(pairs.map((byte) => Number.parseInt(byte, 16)));
}

describe("bitcoinTxidBlobToExplorerHex", () => {
  test("should map ckBTC minter blob order to mempool-style txid hex", () => {
    // given
    const minterBlobOrderHex = "28a727db3afcccba520b0fa0af0e8cd38c10643ce55fba27ab971da832e9233b";
    const minterBytes = hexToBytes(minterBlobOrderHex);
    const EXPECTED_EXPLORER_TXID_HEX =
      "3b23e932a81d97ab27ba5fe53c64108cd38c0eafa00f0b52baccfc3adb27a728";

    // when
    const explorerTxidHex = bitcoinTxidBlobToExplorerHex(minterBytes);

    // then
    expect(explorerTxidHex).toBe(EXPECTED_EXPLORER_TXID_HEX);
    expect(bytesToHex(minterBytes)).toBe(minterBlobOrderHex);
  });
});

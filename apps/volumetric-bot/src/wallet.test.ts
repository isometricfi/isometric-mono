import { describe, expect, test } from "vitest";
import { createWallet } from "./wallet";

// Constants for test data
const TEST_MNEMONIC =
  "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";

// But for now, checking the format is safer.

const TEST_MESSAGE = "test message";

describe("Wallet", () => {
  test("should create a valid testnet wallet from mnemonic", () => {
    // given
    const mnemonic = TEST_MNEMONIC;
    const network = "testnet";

    // when
    const wallet = createWallet(mnemonic, network);

    // then
    expect(wallet.address).toBeDefined();
    expect(wallet.address).toMatch(/^tb1/); // segwit testnet address starts with tb1
  });

  test("should create a valid mainnet wallet from mnemonic", () => {
    // given
    const mnemonic = TEST_MNEMONIC;
    const network = "mainnet";

    // when
    const wallet = createWallet(mnemonic, network);

    // then
    expect(wallet.address).toBeDefined();
    expect(wallet.address).toMatch(/^bc1/); // segwit mainnet address starts with bc1
  });

  test("should sign a message successfully", () => {
    // given
    const mnemonic = TEST_MNEMONIC;
    const network = "testnet";
    const wallet = createWallet(mnemonic, network);
    const message = TEST_MESSAGE;

    // when
    const signature = wallet.signMessage(message);

    // then
    expect(signature).toBeDefined();
    expect(typeof signature).toBe("string");
    expect(signature.length).toBeGreaterThan(0);
  });

  test("should throw error for invalid mnemonic", () => {
    // given
    const invalidMnemonic = "invalid mnemonic word count";
    const network = "testnet";

    // when
    const createInvalidWallet = () => createWallet(invalidMnemonic, network);

    // then
    expect(createInvalidWallet).toThrow();
  });
});

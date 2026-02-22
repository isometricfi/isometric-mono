import * as bitcoin from "bitcoinjs-lib";
import { ECPairFactory } from "ecpair";
import * as ecc from "tiny-secp256k1";
import { describe, expect, test } from "vitest";
import { createWallet } from "./wallet";

const ECPair = ECPairFactory(ecc);
bitcoin.initEccLib(ecc);

const TEST_PRIVATE_KEY_HEX = "0000000000000000000000000000000000000000000000000000000000000001";

const TESTNET_WIF = ECPair.fromPrivateKey(Buffer.from(TEST_PRIVATE_KEY_HEX, "hex"), {
  network: bitcoin.networks.testnet,
  compressed: true,
}).toWIF();

const MAINNET_WIF = ECPair.fromPrivateKey(Buffer.from(TEST_PRIVATE_KEY_HEX, "hex"), {
  network: bitcoin.networks.bitcoin,
  compressed: true,
}).toWIF();

const TEST_MESSAGE = "test message";

describe("Wallet", () => {
  test("should create a valid testnet wallet from WIF", () => {
    // given
    const network = "testnet";

    // when
    const wallet = createWallet(TESTNET_WIF, network);

    // then
    expect(wallet.address).toBeDefined();
    expect(wallet.address).toMatch(/^tb1/); // segwit testnet address starts with tb1
  });

  test("should create a valid mainnet wallet from WIF", () => {
    // given
    const network = "mainnet";

    // when
    const wallet = createWallet(MAINNET_WIF, network);

    // then
    expect(wallet.address).toBeDefined();
    expect(wallet.address).toMatch(/^bc1/); // segwit mainnet address starts with bc1
  });

  test("should sign a message successfully", () => {
    // given
    const network = "testnet";
    const wallet = createWallet(TESTNET_WIF, network);
    const message = TEST_MESSAGE;

    // when
    const signature = wallet.signMessage(message);

    // then
    expect(signature).toBeDefined();
    expect(typeof signature).toBe("string");
    expect(signature.length).toBeGreaterThan(0);
  });

  test("should throw error for invalid WIF", () => {
    // given
    const invalidWif = "invalid-wif";
    const network = "testnet";

    // when
    const createInvalidWallet = () => createWallet(invalidWif, network);

    // then
    expect(createInvalidWallet).toThrow();
  });
});

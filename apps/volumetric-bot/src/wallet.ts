import * as ecc from "@bitcoin-js/tiny-secp256k1-asmjs";
import { Signer } from "bip322-js";
import * as bitcoin from "bitcoinjs-lib";
import { ECPairFactory } from "ecpair";

let isEccInitialized = false;

function getECPair() {
  if (!isEccInitialized) {
    bitcoin.initEccLib(ecc);
    isEccInitialized = true;
  }

  return ECPairFactory(ecc);
}

export interface BotWallet {
  address: string;
  signMessage: (message: string) => string;
}

export function createWallet(privateKeyWif: string, network: "mainnet" | "testnet"): BotWallet {
  const ECPair = getECPair();
  const btcNetwork = network === "mainnet" ? bitcoin.networks.bitcoin : bitcoin.networks.testnet;

  let keyPair: ReturnType<typeof ECPair.fromWIF>;
  try {
    keyPair = ECPair.fromWIF(privateKeyWif, btcNetwork);
  } catch {
    throw new Error(`Invalid WIF private key for ${network}`);
  }

  const { address } = bitcoin.payments.p2wpkh({
    pubkey: Buffer.from(keyPair.publicKey),
    network: btcNetwork,
  });

  if (!address) {
    throw new Error("Failed to derive P2WPKH address");
  }

  const signMessage = (message: string): string => {
    return Signer.sign(privateKeyWif, address, message) as string;
  };

  return { address, signMessage };
}

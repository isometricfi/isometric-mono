import * as bitcoin from "bitcoinjs-lib";
import * as bitcoinMessage from "bitcoinjs-message";
import { ECPairFactory } from "ecpair";
import * as ecc from "tiny-secp256k1";

const ECPair = ECPairFactory(ecc);

bitcoin.initEccLib(ecc);

export interface BotWallet {
  address: string;
  signMessage: (message: string) => string;
}

export function createWallet(privateKeyWif: string, network: "mainnet" | "testnet"): BotWallet {
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
    if (!keyPair.privateKey) {
      throw new Error("Private key not available");
    }

    const signature = bitcoinMessage.sign(message, Buffer.from(keyPair.privateKey), true);
    return signature.toString("base64");
  };

  return { address, signMessage };
}

import { BIP32Factory } from "bip32";
import * as bip39 from "bip39";
import * as bitcoin from "bitcoinjs-lib";
import { ECPairFactory } from "ecpair";
import * as ecc from "tiny-secp256k1";

const ECPair = ECPairFactory(ecc);
const bip32 = BIP32Factory(ecc);

bitcoin.initEccLib(ecc);

const BIP84_DERIVATION_PATH = "m/84'/0'/0'/0/0";
const BIP84_TESTNET_PATH = "m/84'/1'/0'/0/0";

const BTC_MESSAGE_MAGIC = "\x18Bitcoin Signed Message:\n";

export interface BotWallet {
  address: string;
  signMessage: (message: string) => string;
}

function varintEncode(n: number): Buffer {
  if (n < 0xfd) {
    return Buffer.from([n]);
  }
  if (n <= 0xffff) {
    const buf = Buffer.alloc(3);
    buf[0] = 0xfd;
    buf.writeUInt16LE(n, 1);
    return buf;
  }
  const buf = Buffer.alloc(5);
  buf[0] = 0xfe;
  buf.writeUInt32LE(n, 1);
  return buf;
}

function magicHash(message: string): Uint8Array {
  const messageBuffer = Buffer.from(message, "utf8");
  const prefix = Buffer.from(BTC_MESSAGE_MAGIC, "utf8");
  const messageLength = varintEncode(messageBuffer.length);

  const combined = Buffer.concat([prefix, messageLength, messageBuffer]);
  const firstHash = bitcoin.crypto.sha256(combined);
  return bitcoin.crypto.sha256(firstHash);
}

export function createWallet(seedPhrase: string, network: "mainnet" | "testnet"): BotWallet {
  if (!bip39.validateMnemonic(seedPhrase)) {
    throw new Error("Invalid mnemonic");
  }
  const seed = bip39.mnemonicToSeedSync(seedPhrase);
  const btcNetwork = network === "mainnet" ? bitcoin.networks.bitcoin : bitcoin.networks.testnet;
  const root = bip32.fromSeed(seed, btcNetwork);
  const derivationPath = network === "mainnet" ? BIP84_DERIVATION_PATH : BIP84_TESTNET_PATH;
  const child = root.derivePath(derivationPath);

  if (!child.privateKey) {
    throw new Error("Failed to derive private key from seed phrase");
  }

  const keyPair = ECPair.fromPrivateKey(Buffer.from(child.privateKey), {
    network: btcNetwork,
    compressed: true,
  });

  const { address } = bitcoin.payments.p2wpkh({
    pubkey: Buffer.from(keyPair.publicKey),
    network: btcNetwork,
  });

  if (!address) {
    throw new Error("Failed to derive P2WPKH address");
  }

  const signMessage = (message: string): string => {
    const hash = magicHash(message);

    if (!keyPair.privateKey) {
      throw new Error("Private key not available");
    }

    const signature = ecc.signRecoverable(hash, keyPair.privateKey);
    const recoveryFlag = signature.recoveryId + 31;

    const sigBuffer = Buffer.alloc(65);
    sigBuffer[0] = recoveryFlag;
    Buffer.from(signature.signature).copy(sigBuffer, 1);

    return sigBuffer.toString("base64");
  };

  return { address, signMessage };
}

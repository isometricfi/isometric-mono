// node scripts/generate-identity.js

const { Ed25519KeyIdentity } = require("@icp-sdk/core/identity");
const bip39 = require("bip39");

const seedPhrase = process.argv[2];

if (seedPhrase) {
  const seed = bip39.mnemonicToSeedSync(seedPhrase).slice(0, 32);
  const identity = Ed25519KeyIdentity.fromSecretKey(seed);
  const keyPair = identity.getKeyPair();

  console.log("=== Identity from Seed Phrase ===\n");
  console.log("Principal:", identity.getPrincipal().toText());
  console.log("\nPrivate Key (hex):");
  console.log(Buffer.from(keyPair.secretKey).toString("hex"));
} else {
  const mnemonic = bip39.generateMnemonic();
  const seed = bip39.mnemonicToSeedSync(mnemonic).slice(0, 32);
  const identity = Ed25519KeyIdentity.fromSecretKey(seed);
  const keyPair = identity.getKeyPair();

  console.log("=== New Identity with Seed Phrase ===\n");
  console.log("Seed Phrase");
  console.log(mnemonic);
  console.log("\nPrincipal:", identity.getPrincipal().toText());
  console.log("\nPrivate Key (hex):");
  console.log(Buffer.from(keyPair.secretKey).toString("hex"));
}

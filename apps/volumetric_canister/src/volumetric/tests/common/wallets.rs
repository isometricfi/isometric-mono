use bitcoin::secp256k1::{Secp256k1, SecretKey};
use bitcoin::{Address, CompressedPublicKey, Network, PrivateKey, PublicKey};

const TEST_NETWORK: Network = Network::Testnet4;

#[derive(Debug, Clone)]
#[allow(dead_code)]
pub struct TestWallet {
    pub(crate) private_key: PrivateKey,
    pub address: String,
    pub(crate) public_key: PublicKey,
    pub(crate) compressed_public_key: CompressedPublicKey,
}

/// Generates a P2WPKH wallet that signs via BIP-322 simple — matches what
/// real Dynamic/OKX/Xverse/Leather wallets emit from `signMessage`.
pub fn generate_wallet(seed: u64) -> TestWallet {
    let mut seed_bytes = [0u8; 32];
    seed_bytes[0..8].copy_from_slice(&seed.to_le_bytes());

    let secp = Secp256k1::new();
    let secret_key = SecretKey::from_slice(&seed_bytes).expect("Invalid seed");
    let private_key = PrivateKey::new(secret_key, TEST_NETWORK);
    let public_key = PublicKey::from_private_key(&secp, &private_key);
    let compressed_public_key = CompressedPublicKey::from_private_key(&secp, &private_key)
        .expect("Failed to create compressed public key");

    let address = Address::p2wpkh(&compressed_public_key, TEST_NETWORK).to_string();

    TestWallet {
        private_key,
        address,
        public_key,
        compressed_public_key,
    }
}

/// Produces a base64-encoded BIP-322 simple signature for `message` using the
/// wallet's private key.
#[allow(dead_code)]
pub fn sign_message(wallet: &TestWallet, message: &str) -> String {
    let wif = wallet.private_key.to_wif();
    bip322::sign_simple_encoded(&wallet.address, message, &[wif], None)
        .expect("failed to produce BIP-322 signature")
}

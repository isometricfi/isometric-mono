use base64::{engine::general_purpose, Engine as _};
use bitcoin::hashes::{sha256, Hash, HashEngine};
use bitcoin::secp256k1::{Message, Secp256k1, SecretKey};
use bitcoin::{Address, CompressedPublicKey, Network, PrivateKey, PublicKey};

#[allow(dead_code)]
#[derive(Debug, Clone)]
pub struct TestWallet {
    pub(crate) private_key: PrivateKey,
    pub address: String,
    pub(crate) public_key: PublicKey,
    pub(crate) compressed_public_key: CompressedPublicKey,
}

pub fn generate_wallet(seed: u64) -> TestWallet {
    let mut seed_bytes = [0u8; 32];
    seed_bytes[0..8].copy_from_slice(&seed.to_le_bytes());

    let secp = Secp256k1::new();
    let secret_key = SecretKey::from_slice(&seed_bytes).expect("Invalid seed");
    let private_key = PrivateKey::new(secret_key, Network::Testnet4);
    let public_key = PublicKey::from_private_key(&secp, &private_key);
    let compressed_public_key = CompressedPublicKey::from_private_key(&secp, &private_key)
        .expect("Failed to create compressed public key");

    let address = Address::p2wpkh(&compressed_public_key, Network::Testnet4).to_string();

    TestWallet {
        private_key,
        address,
        public_key,
        compressed_public_key,
    }
}

#[allow(dead_code)]
const BTC_MESSAGE_PREFIX: &[u8] = b"\x18Bitcoin Signed Message:\n";
#[allow(dead_code)]
const RECOVERY_BASE_NATIVE_SEGWIT: u8 = 31;

#[allow(dead_code)]
fn legacy_message_hash(message: &[u8]) -> [u8; 32] {
    let mut engine = sha256::Hash::engine();
    engine.input(BTC_MESSAGE_PREFIX);
    engine.input(&varint_encode(message.len()));
    engine.input(message);
    let first_hash = sha256::Hash::from_engine(engine);
    sha256::Hash::hash(first_hash.as_ref()).to_byte_array()
}

#[allow(dead_code)]
fn varint_encode(n: usize) -> Vec<u8> {
    if n < 0xfd {
        vec![n as u8]
    } else if n <= 0xffff {
        let mut v = vec![0xfd];
        v.extend_from_slice(&(n as u16).to_le_bytes());
        v
    } else {
        let mut v = vec![0xfe];
        v.extend_from_slice(&(n as u32).to_le_bytes());
        v
    }
}

#[allow(dead_code)]
pub fn sign_message(wallet: &TestWallet, message: &str) -> String {
    let secp = Secp256k1::new();

    let message_hash = legacy_message_hash(message.as_bytes());
    let msg = Message::from_digest(message_hash);

    let (recovery_id, signature) = secp
        .sign_ecdsa_recoverable(&msg, &wallet.private_key.inner)
        .serialize_compact();

    let header = RECOVERY_BASE_NATIVE_SEGWIT + recovery_id.to_i32() as u8;

    let mut sig_bytes = vec![header];
    sig_bytes.extend_from_slice(&signature);

    general_purpose::STANDARD.encode(sig_bytes)
}

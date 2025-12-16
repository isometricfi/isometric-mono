use base64::prelude::*;
use bitcoin::address::NetworkUnchecked;
use bitcoin::hashes::{sha256, Hash, HashEngine};
use bitcoin::secp256k1::ecdsa::{RecoverableSignature, RecoveryId};
use bitcoin::secp256k1::{Message, Secp256k1};
use bitcoin::{Address, CompressedPublicKey, Network, Witness};

use crate::errors::VolumetricError;
use crate::storage::{BtcNetwork, Config};

const LEGACY_SIGNATURE_LENGTH: usize = 65;
const BTC_MESSAGE_PREFIX: &[u8] = b"\x18Bitcoin Signed Message:\n";

fn get_bitcoin_network() -> Network {
    match Config::btc_network() {
        BtcNetwork::Mainnet => Network::Bitcoin,
        BtcNetwork::Testnet => Network::Testnet4,
    }
}

pub fn verify_btc_signature(
    address: &str,
    message: &str,
    signature_base64: &str,
) -> Result<(), VolumetricError> {
    let unchecked_address: Address<NetworkUnchecked> = address
        .parse()
        .map_err(|e| VolumetricError::invalid_signature(&format!("Invalid address: {}", e)))?;

    let network = get_bitcoin_network();
    let btc_address = unchecked_address
        .require_network(network)
        .map_err(|e| VolumetricError::invalid_signature(&format!("Invalid network: {}", e)))?;

    let signature_bytes = BASE64_STANDARD
        .decode(signature_base64)
        .map_err(|e| VolumetricError::invalid_signature(&format!("Invalid base64: {}", e)))?;

    if signature_bytes.len() == LEGACY_SIGNATURE_LENGTH {
        verify_legacy_signature(&btc_address, message, &signature_bytes, network)
    } else {
        verify_bip322_signature(&btc_address, message, &signature_bytes)
    }
}

fn verify_legacy_signature(
    btc_address: &Address,
    message: &str,
    signature_bytes: &[u8],
    network: Network,
) -> Result<(), VolumetricError> {
    let header = signature_bytes[0];
    let r_s = &signature_bytes[1..LEGACY_SIGNATURE_LENGTH];

    const RECOVERY_BASE_UNCOMPRESSED: u8 = 27;
    const RECOVERY_BASE_COMPRESSED: u8 = 31;
    const RECOVERY_BASE_SEGWIT: u8 = 35;
    const RECOVERY_BASE_SEGWIT_ALT: u8 = 39;

    let recovery_id = match header {
        27..=30 => header - RECOVERY_BASE_UNCOMPRESSED,
        31..=34 => header - RECOVERY_BASE_COMPRESSED,
        35..=38 => header - RECOVERY_BASE_SEGWIT,
        39..=42 => header - RECOVERY_BASE_SEGWIT_ALT,
        _ => {
            return Err(VolumetricError::invalid_signature(
                "Invalid recovery header",
            ))
        }
    };

    let message_hash = legacy_message_hash(message.as_bytes());
    let secp = Secp256k1::verification_only();

    let rec_id = RecoveryId::from_i32(recovery_id as i32)
        .map_err(|e| VolumetricError::invalid_signature(&format!("Invalid recovery id: {}", e)))?;

    let recoverable_sig = RecoverableSignature::from_compact(r_s, rec_id)
        .map_err(|e| VolumetricError::invalid_signature(&format!("Invalid signature: {}", e)))?;

    let msg = Message::from_digest(message_hash);

    let pubkey = secp
        .recover_ecdsa(&msg, &recoverable_sig)
        .map_err(|e| VolumetricError::invalid_signature(&format!("Recovery failed: {}", e)))?;

    let compressed_pubkey = CompressedPublicKey(pubkey);
    let recovered_address = Address::p2wpkh(&compressed_pubkey, network);

    if recovered_address != *btc_address {
        return Err(VolumetricError::invalid_signature(&format!(
            "Signature does not match address. Expected {}, got {}",
            btc_address, recovered_address
        )));
    }

    Ok(())
}

fn verify_bip322_signature(
    btc_address: &Address,
    message: &str,
    signature_bytes: &[u8],
) -> Result<(), VolumetricError> {
    let witness = Witness::from_slice(&[signature_bytes]);

    bip322::verify_simple(btc_address, message, witness).map_err(|e| {
        VolumetricError::invalid_signature(&format!("BIP-322 verification failed: {}", e))
    })
}

fn legacy_message_hash(message: &[u8]) -> [u8; 32] {
    let mut engine = sha256::Hash::engine();
    engine.input(BTC_MESSAGE_PREFIX);
    engine.input(&varint_encode(message.len()));
    engine.input(message);
    let first_hash = sha256::Hash::from_engine(engine);

    sha256::Hash::hash(first_hash.as_ref()).to_byte_array()
}

fn varint_encode(n: usize) -> Vec<u8> {
    const VARINT_THRESHOLD_U8: usize = 0xfd;
    const VARINT_THRESHOLD_U16: usize = 0xffff;

    if n < VARINT_THRESHOLD_U8 {
        vec![n as u8]
    } else if n <= VARINT_THRESHOLD_U16 {
        let mut v = vec![0xfd];
        v.extend_from_slice(&(n as u16).to_le_bytes());
        v
    } else {
        let mut v = vec![0xfe];
        v.extend_from_slice(&(n as u32).to_le_bytes());
        v
    }
}

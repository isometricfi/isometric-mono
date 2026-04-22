use base64::prelude::*;
use bitcoin::address::{AddressData, NetworkUnchecked};
use bitcoin::hashes::{hash160, sha256, Hash, HashEngine};
use bitcoin::secp256k1::ecdsa::{RecoverableSignature, RecoveryId};
use bitcoin::secp256k1::{Message, Secp256k1};
use bitcoin::{Address, Network, PublicKey, ScriptBuf};

use crate::errors::{error_codes, VolumetricError};
use crate::storage::{BtcNetwork, Config};

const LEGACY_SIGNATURE_LENGTH: usize = 65;
const BTC_MESSAGE_PREFIX: &[u8] = b"\x18Bitcoin Signed Message:\n";

/// BIP-137 legacy "Bitcoin signed message" header byte ranges.
///
/// Each range encodes `(recovery_id, address_kind)` and is strictly bound to
/// one address type. See Bitcoin Core `src/key.cpp` `CPubKey::RecoverCompact`
/// and the BIP-137 / Trezor / Electrum conventions for segwit extensions.
const LEGACY_HEADER_P2PKH_UNCOMPRESSED_BASE: u8 = 27; // 27..=30 → P2PKH uncompressed
const LEGACY_HEADER_P2PKH_COMPRESSED_BASE: u8 = 31; // 31..=34 → P2PKH compressed
const LEGACY_HEADER_P2SH_P2WPKH_BASE: u8 = 35; // 35..=38 → P2SH-P2WPKH
const LEGACY_HEADER_P2WPKH_BASE: u8 = 39; // 39..=42 → P2WPKH native segwit
const LEGACY_HEADER_MAX_PLUS_ONE: u8 = 43;

fn configured_network() -> Network {
    match Config::btc_network() {
        BtcNetwork::Mainnet => Network::Bitcoin,
        BtcNetwork::Testnet => Network::Testnet4,
    }
}

/// Verifies a Bitcoin signature for `message` produced by the private key of
/// `address`, using the canister's configured network.
pub fn verify_btc_signature(
    address: &str,
    message: &str,
    signature_base64: &str,
) -> Result<(), VolumetricError> {
    verify_btc_signature_on_network(address, message, signature_base64, configured_network())
}

/// Same as [`verify_btc_signature`] but takes an explicit network, so the
/// verifier can be unit-tested without touching stable storage.
///
/// The verifier runs each supported scheme in turn. A scheme that accepts the
/// bytes as its format and cryptographically verifies against the exact
/// address terminates with `Ok`. If no scheme accepts, the accumulated
/// per-scheme errors are surfaced together so debugging a real rejection
/// doesn't require guessing which scheme the client intended.
///
/// Each scheme is strictly bound to the address types it covers:
/// - BIP-322 simple: P2WPKH, P2SH-P2WPKH, P2TR (delegated to the `bip322` crate).
/// - BIP-137 legacy: P2PKH, P2SH-P2WPKH, P2WPKH — with header-to-address-type
///   binding. Recovery never synthesizes an address from the recovered key;
///   it only checks that the recovered key hashes to the caller's existing
///   address under the matching derivation.
pub fn verify_btc_signature_on_network(
    address: &str,
    message: &str,
    signature_base64: &str,
    network: Network,
) -> Result<(), VolumetricError> {
    let btc_address = parse_address(address, network)?;

    let bip322_err = match try_verify_bip322_simple(&btc_address, message, signature_base64) {
        Ok(()) => return Ok(()),
        Err(e) => e,
    };

    let bip137_err = match try_verify_bip137(&btc_address, message, signature_base64) {
        Ok(()) => return Ok(()),
        Err(e) => e,
    };

    Err(VolumetricError::from_def(
        error_codes::INVALID_SIGNATURE,
        Some(&format!(
            "no supported scheme verified (bip322: {}; bip137: {})",
            bip322_err, bip137_err
        )),
        None,
    ))
}

fn parse_address(address: &str, network: Network) -> Result<Address, VolumetricError> {
    let unchecked_address: Address<NetworkUnchecked> = address.parse().map_err(|e| {
        VolumetricError::from_def(
            error_codes::INVALID_SIGNATURE,
            Some(&format!("Invalid address: {}", e)),
            None,
        )
    })?;

    unchecked_address.require_network(network).map_err(|e| {
        VolumetricError::from_def(
            error_codes::INVALID_SIGNATURE,
            Some(&format!("Invalid network: {}", e)),
            None,
        )
    })
}

/// Delegates to the `bip322` crate, which consensus-decodes the witness stack
/// and dispatches on the address kind (P2WPKH, P2SH-P2WPKH, P2TR).
fn try_verify_bip322_simple(
    btc_address: &Address,
    message: &str,
    signature_base64: &str,
) -> Result<(), String> {
    bip322::verify_simple_encoded(&btc_address.to_string(), message, signature_base64)
        .map_err(|e| format!("{}", e))
}

/// BIP-137 legacy signed-message verification.
///
/// The header byte simultaneously encodes the recovery id and the intended
/// address kind. We require the caller's address to match that kind; if not,
/// this scheme simply doesn't apply to this input and the outer verifier can
/// try another scheme.
fn try_verify_bip137(
    btc_address: &Address,
    message: &str,
    signature_base64: &str,
) -> Result<(), String> {
    let signature_bytes = BASE64_STANDARD
        .decode(signature_base64)
        .map_err(|e| format!("base64 decode failed: {}", e))?;

    if signature_bytes.len() != LEGACY_SIGNATURE_LENGTH {
        return Err(format!(
            "expected {}-byte recoverable signature, got {}",
            LEGACY_SIGNATURE_LENGTH,
            signature_bytes.len()
        ));
    }

    let header = signature_bytes[0];
    let kind = classify_bip137_header(header)?;
    let recovery_offset = header - kind.base();

    let recovery_id = RecoveryId::from_i32(recovery_offset as i32)
        .map_err(|e| format!("invalid recovery id: {}", e))?;

    let recoverable_sig = RecoverableSignature::from_compact(&signature_bytes[1..], recovery_id)
        .map_err(|e| format!("invalid signature: {}", e))?;

    let message_hash = legacy_message_hash(message.as_bytes());
    let msg = Message::from_digest(message_hash);

    let secp = Secp256k1::verification_only();
    let recovered_key = secp
        .recover_ecdsa(&msg, &recoverable_sig)
        .map_err(|e| format!("recovery failed: {}", e))?;

    let is_compressed = kind.is_compressed();
    let recovered_pubkey = PublicKey {
        compressed: is_compressed,
        inner: recovered_key,
    };
    let serialized_pubkey = if is_compressed {
        recovered_pubkey.inner.serialize().to_vec()
    } else {
        recovered_pubkey.inner.serialize_uncompressed().to_vec()
    };
    let recovered_pubkey_hash = hash160::Hash::hash(&serialized_pubkey);

    match (kind, btc_address.to_address_data()) {
        (Bip137Kind::P2pkhUncompressed, AddressData::P2pkh { pubkey_hash })
        | (Bip137Kind::P2pkhCompressed, AddressData::P2pkh { pubkey_hash }) => ensure_hash_matches(
            "P2PKH pubkey hash",
            recovered_pubkey_hash,
            *pubkey_hash.as_raw_hash(),
        ),
        (Bip137Kind::P2wpkh, AddressData::Segwit { witness_program })
            if witness_program.version().to_num() == 0 && witness_program.program().len() == 20 =>
        {
            let expected =
                <[u8; 20]>::try_from(witness_program.program().as_bytes()).expect("len==20");
            if recovered_pubkey_hash.to_byte_array() != expected {
                return Err("recovered pubkey hash does not match P2WPKH witness program".into());
            }
            Ok(())
        }
        (Bip137Kind::P2shP2wpkh, AddressData::P2sh { script_hash }) => {
            let recovered_pubkey_hash_bytes = recovered_pubkey_hash.to_byte_array();
            let redeem_script = ScriptBuf::new_p2wpkh(
                &bitcoin::WPubkeyHash::from_slice(&recovered_pubkey_hash_bytes)
                    .expect("hash160 is 20 bytes"),
            );
            let redeem_script_hash = hash160::Hash::hash(redeem_script.as_bytes());
            ensure_hash_matches(
                "P2SH-P2WPKH script hash",
                redeem_script_hash,
                *script_hash.as_raw_hash(),
            )
        }
        (kind, _) => Err(format!(
            "header byte {} declares {:?} but address is a different type",
            header, kind
        )),
    }
}

fn ensure_hash_matches(
    label: &str,
    recovered: hash160::Hash,
    expected: hash160::Hash,
) -> Result<(), String> {
    if recovered != expected {
        return Err(format!("recovered {} does not match address", label));
    }
    Ok(())
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum Bip137Kind {
    P2pkhUncompressed,
    P2pkhCompressed,
    P2shP2wpkh,
    P2wpkh,
}

impl Bip137Kind {
    fn base(self) -> u8 {
        match self {
            Bip137Kind::P2pkhUncompressed => LEGACY_HEADER_P2PKH_UNCOMPRESSED_BASE,
            Bip137Kind::P2pkhCompressed => LEGACY_HEADER_P2PKH_COMPRESSED_BASE,
            Bip137Kind::P2shP2wpkh => LEGACY_HEADER_P2SH_P2WPKH_BASE,
            Bip137Kind::P2wpkh => LEGACY_HEADER_P2WPKH_BASE,
        }
    }

    fn is_compressed(self) -> bool {
        !matches!(self, Bip137Kind::P2pkhUncompressed)
    }
}

fn classify_bip137_header(header: u8) -> Result<Bip137Kind, String> {
    if (LEGACY_HEADER_P2PKH_UNCOMPRESSED_BASE..LEGACY_HEADER_P2PKH_COMPRESSED_BASE)
        .contains(&header)
    {
        return Ok(Bip137Kind::P2pkhUncompressed);
    }
    if (LEGACY_HEADER_P2PKH_COMPRESSED_BASE..LEGACY_HEADER_P2SH_P2WPKH_BASE).contains(&header) {
        return Ok(Bip137Kind::P2pkhCompressed);
    }
    if (LEGACY_HEADER_P2SH_P2WPKH_BASE..LEGACY_HEADER_P2WPKH_BASE).contains(&header) {
        return Ok(Bip137Kind::P2shP2wpkh);
    }
    if (LEGACY_HEADER_P2WPKH_BASE..LEGACY_HEADER_MAX_PLUS_ONE).contains(&header) {
        return Ok(Bip137Kind::P2wpkh);
    }
    Err(format!("header byte {} is outside BIP-137 range", header))
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
    const VARINT_THRESHOLD_U32: usize = 0xffff_ffff;

    if n < VARINT_THRESHOLD_U8 {
        vec![n as u8]
    } else if n <= VARINT_THRESHOLD_U16 {
        let mut v = vec![0xfd];
        v.extend_from_slice(&(n as u16).to_le_bytes());
        v
    } else if n <= VARINT_THRESHOLD_U32 {
        let mut v = vec![0xfe];
        v.extend_from_slice(&(n as u32).to_le_bytes());
        v
    } else {
        let mut v = vec![0xff];
        v.extend_from_slice(&(n as u64).to_le_bytes());
        v
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use base64::engine::general_purpose;
    use bitcoin::secp256k1::{Secp256k1, SecretKey};
    use bitcoin::{CompressedPublicKey, PrivateKey, PubkeyHash};

    fn sign_bip137(secret_bytes: [u8; 32], message: &str, kind: Bip137Kind) -> (String, String) {
        let secp = Secp256k1::new();
        let secret_key = SecretKey::from_slice(&secret_bytes).unwrap();
        let is_compressed = kind.is_compressed();
        let private_key = PrivateKey {
            compressed: is_compressed,
            network: Network::Bitcoin.into(),
            inner: secret_key,
        };

        let pubkey = PublicKey::from_private_key(&secp, &private_key);
        let pubkey_hash_bytes = if is_compressed {
            hash160::Hash::hash(&pubkey.inner.serialize())
        } else {
            hash160::Hash::hash(&pubkey.inner.serialize_uncompressed())
        };

        let address = match kind {
            Bip137Kind::P2pkhUncompressed | Bip137Kind::P2pkhCompressed => {
                let pubkey_hash = PubkeyHash::from_raw_hash(pubkey_hash_bytes);
                Address::p2pkh(pubkey_hash, Network::Bitcoin)
            }
            Bip137Kind::P2wpkh => {
                let compressed =
                    CompressedPublicKey::from_private_key(&secp, &private_key).unwrap();
                Address::p2wpkh(&compressed, Network::Bitcoin)
            }
            Bip137Kind::P2shP2wpkh => {
                let compressed =
                    CompressedPublicKey::from_private_key(&secp, &private_key).unwrap();
                Address::p2shwpkh(&compressed, Network::Bitcoin)
            }
        };

        let hash = legacy_message_hash(message.as_bytes());
        let msg = Message::from_digest(hash);
        let (recovery_id, sig) = secp
            .sign_ecdsa_recoverable(&msg, &secret_key)
            .serialize_compact();

        let header = kind.base() + recovery_id.to_i32() as u8;
        let mut bytes = vec![header];
        bytes.extend_from_slice(&sig);
        (address.to_string(), general_purpose::STANDARD.encode(bytes))
    }

    #[test]
    fn verify_accepts_round_trip_p2pkh_compressed() {
        // given
        let secret = [1u8; 32];
        let message = "btc-auth-v1\naction=withdraw_ckbtc\namount_sats=1";
        let (address, signature) = sign_bip137(secret, message, Bip137Kind::P2pkhCompressed);

        // when
        let result =
            verify_btc_signature_on_network(&address, message, &signature, Network::Bitcoin);

        // then
        assert!(
            result.is_ok(),
            "verifier rejected own signature: {:?}",
            result
        );
    }

    #[test]
    fn verify_accepts_round_trip_p2pkh_uncompressed() {
        // given
        let secret = [2u8; 32];
        let message = "hello world";
        let (address, signature) = sign_bip137(secret, message, Bip137Kind::P2pkhUncompressed);

        // when
        let result =
            verify_btc_signature_on_network(&address, message, &signature, Network::Bitcoin);

        // then
        assert!(
            result.is_ok(),
            "verifier rejected own signature: {:?}",
            result
        );
    }

    #[test]
    fn verify_accepts_round_trip_p2wpkh_bip137() {
        // given
        let secret = [3u8; 32];
        let message = "native segwit signed the old way";
        let (address, signature) = sign_bip137(secret, message, Bip137Kind::P2wpkh);

        // when
        let result =
            verify_btc_signature_on_network(&address, message, &signature, Network::Bitcoin);

        // then
        assert!(
            result.is_ok(),
            "verifier rejected own signature: {:?}",
            result
        );
    }

    #[test]
    fn verify_accepts_round_trip_p2sh_p2wpkh_bip137() {
        // given
        let secret = [4u8; 32];
        let message = "nested segwit";
        let (address, signature) = sign_bip137(secret, message, Bip137Kind::P2shP2wpkh);

        // when
        let result =
            verify_btc_signature_on_network(&address, message, &signature, Network::Bitcoin);

        // then
        assert!(
            result.is_ok(),
            "verifier rejected own signature: {:?}",
            result
        );
    }

    #[test]
    fn verify_rejects_tampered_message() {
        // given
        let secret = [5u8; 32];
        let (address, signature) = sign_bip137(secret, "real message", Bip137Kind::P2wpkh);

        // when
        let result = verify_btc_signature_on_network(
            &address,
            "tampered message",
            &signature,
            Network::Bitcoin,
        );

        // then
        assert!(result.is_err());
    }

    #[test]
    fn verify_rejects_p2wpkh_header_against_p2pkh_address() {
        // given
        let secret = [6u8; 32];
        let (p2pkh_address, _sig) = sign_bip137(secret, "msg", Bip137Kind::P2pkhCompressed);
        let (_p2wpkh_address, p2wpkh_signature) = sign_bip137(secret, "msg", Bip137Kind::P2wpkh);

        // when
        let result = verify_btc_signature_on_network(
            &p2pkh_address,
            "msg",
            &p2wpkh_signature,
            Network::Bitcoin,
        );

        // then
        assert!(result.is_err());
    }

    #[test]
    fn verify_rejects_p2pkh_header_against_p2wpkh_address() {
        // given
        let secret = [7u8; 32];
        let (_p2pkh_address, p2pkh_signature) =
            sign_bip137(secret, "msg", Bip137Kind::P2pkhCompressed);
        let (p2wpkh_address, _sig) = sign_bip137(secret, "msg", Bip137Kind::P2wpkh);

        // when
        let result = verify_btc_signature_on_network(
            &p2wpkh_address,
            "msg",
            &p2pkh_signature,
            Network::Bitcoin,
        );

        // then
        assert!(result.is_err());
    }

    /// "Hello World" vector from the BIP-322 reference implementation.
    /// See https://github.com/bitcoin/bips/blob/master/bip-0322.mediawiki
    #[test]
    fn verify_accepts_bip322_simple_spec_p2wpkh_vector() {
        // given
        let address = "bc1q9vza2e8x573nczrlzms0wvx3gsqjx7vavgkx0l";
        let message = "Hello World";
        let signature = "AkgwRQIhAOzyynlqt93lOKJr+wmmxIens//zPzl9tqIOua93wO6MAiBi5n5EyAcPScOjf1lAqIUIQtr3zKNeavYabHyR8eGhowEhAsfxIAMZZEKUPYWI4BruhAQjzFT8FSFSajuFwrDL1Yhy";

        // when
        let result = verify_btc_signature_on_network(address, message, signature, Network::Bitcoin);

        // then
        assert!(result.is_ok(), "spec vector failed: {:?}", result);
    }

    #[test]
    fn verify_rejects_bip322_simple_with_wrong_message() {
        // given
        let address = "bc1q9vza2e8x573nczrlzms0wvx3gsqjx7vavgkx0l";
        let signature = "AkgwRQIhAOzyynlqt93lOKJr+wmmxIens//zPzl9tqIOua93wO6MAiBi5n5EyAcPScOjf1lAqIUIQtr3zKNeavYabHyR8eGhowEhAsfxIAMZZEKUPYWI4BruhAQjzFT8FSFSajuFwrDL1Yhy";

        // when
        let result =
            verify_btc_signature_on_network(address, "Goodbye World", signature, Network::Bitcoin);

        // then
        assert!(result.is_err());
    }

    #[test]
    fn verify_rejects_random_65_byte_blob() {
        // given
        let address = "bc1q9vza2e8x573nczrlzms0wvx3gsqjx7vavgkx0l";
        let garbage = general_purpose::STANDARD.encode([0u8; 65]);

        // when
        let result = verify_btc_signature_on_network(address, "msg", &garbage, Network::Bitcoin);

        // then
        assert!(result.is_err());
    }

    #[test]
    fn classify_bip137_header_rejects_out_of_range_values() {
        // given
        let too_low = 26u8;
        let too_high = 43u8;

        // when / then
        assert!(classify_bip137_header(too_low).is_err());
        assert!(classify_bip137_header(too_high).is_err());
    }

    #[test]
    fn varint_encode_uses_bitcoin_var_int_framing() {
        // given
        let short = 100_usize;
        let mid = 1_000_usize;
        let large = 100_000_usize;

        // when
        let short_bytes = varint_encode(short);
        let mid_bytes = varint_encode(mid);
        let large_bytes = varint_encode(large);

        // then
        assert_eq!(short_bytes, vec![100]);
        assert_eq!(mid_bytes, vec![0xfd, 0xe8, 0x03]);
        assert_eq!(large_bytes, vec![0xfe, 0xa0, 0x86, 0x01, 0x00]);
    }
}

use base64::prelude::*;
use bitcoin::address::{AddressData, NetworkUnchecked};
use bitcoin::hashes::{hash160, sha256, Hash, HashEngine};
use bitcoin::secp256k1::ecdsa::{RecoverableSignature, RecoveryId};
use bitcoin::secp256k1::{Message, Secp256k1};
use bitcoin::{Address, Network, ScriptBuf};

use crate::errors::{error_codes, VolumetricError};
use crate::storage::{BtcNetwork, Config};

const LEGACY_SIGNATURE_LENGTH: usize = 65;
const BTC_MESSAGE_PREFIX: &[u8] = b"\x18Bitcoin Signed Message:\n";

/// Half the order of the secp256k1 group, big-endian.
///
/// A canonical ECDSA signature has `s <= N/2` (a.k.a. "low-s"). Enforcing
/// this rejects the malleated twin `(r, N-s)` that any valid signature
/// silently has, closing the ECDSA-malleability class of attacks. See
/// Bitcoin Core's `CheckSignatureEncoding` / BIP-146.
const SECP256K1_HALF_ORDER_BE: [u8; 32] = [
    0x7F, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF,
    0x5D, 0x57, 0x6E, 0x73, 0x57, 0xA4, 0x50, 0x1D, 0xDF, 0xE9, 0x2F, 0x46, 0x68, 0x1B, 0x20, 0xA0,
];

/// BIP-137 legacy "Bitcoin signed message" header byte ranges.
///
/// The header always carries `(recovery_id, is_compressed)`. The sub-ranges
/// 35..=38 and 39..=42 were later added by Trezor/Electrum as optional
/// address-type hints, but wallets in the wild (notably UniSat) routinely
/// emit headers 31..=34 for segwit addresses too. The hint is therefore
/// treated as non-authoritative — verification binds the recovered pubkey to
/// the caller's *actual* address type, regardless of what the header claimed.
const LEGACY_HEADER_MIN: u8 = 27;
const LEGACY_HEADER_UNCOMPRESSED_MAX_PLUS_ONE: u8 = 31; // 27..=30 → uncompressed
const LEGACY_HEADER_MAX_PLUS_ONE: u8 = 43; // 31..=42 → compressed (any address-type hint)

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
/// The header byte encodes `(recovery_id, is_compressed)`. Ranges 35..=42 add
/// an optional address-type hint that some wallets emit and others don't —
/// we ignore the hint and instead match the recovered pubkey against the
/// caller's actual address type. This is what UniSat's default `signMessage`
/// needs: header 31–34 paired with a native segwit address.
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

    const S_COMPONENT_OFFSET: usize = 33;
    const S_COMPONENT_END: usize = 65;
    let mut s_bytes = [0u8; 32];
    s_bytes.copy_from_slice(&signature_bytes[S_COMPONENT_OFFSET..S_COMPONENT_END]);
    if !is_low_s(&s_bytes) {
        return Err("high-s signature rejected (non-canonical, malleable)".into());
    }

    let header = signature_bytes[0];
    let (recovery_offset, is_compressed) = decode_bip137_header(header)?;

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

    let serialized_pubkey = if is_compressed {
        recovered_key.serialize().to_vec()
    } else {
        recovered_key.serialize_uncompressed().to_vec()
    };
    let recovered_pubkey_hash = hash160::Hash::hash(&serialized_pubkey);

    match btc_address.to_address_data() {
        AddressData::P2pkh { pubkey_hash } => ensure_hash_matches(
            "P2PKH pubkey hash",
            recovered_pubkey_hash,
            *pubkey_hash.as_raw_hash(),
        ),
        AddressData::Segwit { witness_program }
            if witness_program.version().to_num() == 0 && witness_program.program().len() == 20 =>
        {
            if !is_compressed {
                return Err(
                    "P2WPKH addresses require a compressed-key signature (header 31–42)".into(),
                );
            }
            let expected =
                <[u8; 20]>::try_from(witness_program.program().as_bytes()).expect("len==20");
            if recovered_pubkey_hash.to_byte_array() != expected {
                return Err("recovered pubkey hash does not match P2WPKH witness program".into());
            }
            Ok(())
        }
        AddressData::P2sh { script_hash } => {
            if !is_compressed {
                return Err(
                    "P2SH-P2WPKH addresses require a compressed-key signature (header 31–42)"
                        .into(),
                );
            }
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
        _ => {
            Err("address type is not supported for BIP-137 (taproot / P2WSH / unrecognized)".into())
        }
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

/// Returns `true` when `s_bytes` is in the lower half of the curve order,
/// i.e. the canonical low-s form. Uses a plain big-endian byte compare
/// against `N/2` — no arithmetic, no timing pitfalls, no external crate.
fn is_low_s(s_bytes: &[u8; 32]) -> bool {
    for i in 0..32 {
        match s_bytes[i].cmp(&SECP256K1_HALF_ORDER_BE[i]) {
            std::cmp::Ordering::Less => return true,
            std::cmp::Ordering::Greater => return false,
            std::cmp::Ordering::Equal => continue,
        }
    }
    true
}

const BIP137_RECOVERY_IDS_PER_RANGE: u8 = 4;

fn decode_bip137_header(header: u8) -> Result<(u8, bool), String> {
    if !(LEGACY_HEADER_MIN..LEGACY_HEADER_MAX_PLUS_ONE).contains(&header) {
        return Err(format!("header byte {} is outside BIP-137 range", header));
    }
    let recovery_offset = (header - LEGACY_HEADER_MIN) % BIP137_RECOVERY_IDS_PER_RANGE;
    let is_compressed = header >= LEGACY_HEADER_UNCOMPRESSED_MAX_PLUS_ONE;
    Ok((recovery_offset, is_compressed))
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
    use bitcoin::{CompressedPublicKey, PrivateKey, PubkeyHash, PublicKey};

    const HEADER_BASE_UNCOMPRESSED: u8 = 27;
    const HEADER_BASE_COMPRESSED: u8 = 31;
    const HEADER_BASE_P2SH_P2WPKH_HINT: u8 = 35;
    const HEADER_BASE_P2WPKH_HINT: u8 = 39;

    #[derive(Debug, Clone, Copy)]
    enum WalletAddressType {
        P2pkh,
        P2wpkh,
        P2shP2wpkh,
    }

    /// Signs `message` with the BIP-137 / Satoshi legacy format and returns
    /// `(address, base64 signature)`. `header_base` chooses which of the four
    /// header-byte ranges the signature advertises — this lets tests replicate
    /// real-world wallet quirks (UniSat emitting header 31 on a bech32
    /// address, Trezor emitting 39, etc.).
    fn sign_bip137(
        secret_bytes: [u8; 32],
        message: &str,
        address_type: WalletAddressType,
        header_base: u8,
    ) -> (String, String) {
        let is_compressed = header_base >= HEADER_BASE_COMPRESSED;
        let secp = Secp256k1::new();
        let secret_key = SecretKey::from_slice(&secret_bytes).unwrap();
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

        let address = match address_type {
            WalletAddressType::P2pkh => {
                let pubkey_hash = PubkeyHash::from_raw_hash(pubkey_hash_bytes);
                Address::p2pkh(pubkey_hash, Network::Bitcoin)
            }
            WalletAddressType::P2wpkh => {
                let compressed =
                    CompressedPublicKey::from_private_key(&secp, &private_key).unwrap();
                Address::p2wpkh(&compressed, Network::Bitcoin)
            }
            WalletAddressType::P2shP2wpkh => {
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

        let header = header_base + recovery_id.to_i32() as u8;
        let mut bytes = vec![header];
        bytes.extend_from_slice(&sig);
        (address.to_string(), general_purpose::STANDARD.encode(bytes))
    }

    #[test]
    fn verify_accepts_round_trip_p2pkh_compressed() {
        // given
        let secret = [1u8; 32];
        let message = "btc-auth-v1\naction=withdraw_ckbtc\namount_sats=1";
        let (address, signature) = sign_bip137(
            secret,
            message,
            WalletAddressType::P2pkh,
            HEADER_BASE_COMPRESSED,
        );

        // when
        let result =
            verify_btc_signature_on_network(&address, message, &signature, Network::Bitcoin);

        // then
        assert!(result.is_ok(), "verifier rejected: {:?}", result);
    }

    #[test]
    fn verify_accepts_round_trip_p2pkh_uncompressed() {
        // given
        let secret = [2u8; 32];
        let message = "hello world";
        let (address, signature) = sign_bip137(
            secret,
            message,
            WalletAddressType::P2pkh,
            HEADER_BASE_UNCOMPRESSED,
        );

        // when
        let result =
            verify_btc_signature_on_network(&address, message, &signature, Network::Bitcoin);

        // then
        assert!(result.is_ok(), "verifier rejected: {:?}", result);
    }

    /// UniSat's default `signMessage` emits header bytes 31–34 even for a
    /// native segwit (bech32) address. This is the real-world case we must
    /// accept.
    #[test]
    fn verify_accepts_unisat_style_compressed_header_on_p2wpkh_address() {
        // given
        let secret = [3u8; 32];
        let message = "native segwit signed with compressed P2PKH header";
        let (address, signature) = sign_bip137(
            secret,
            message,
            WalletAddressType::P2wpkh,
            HEADER_BASE_COMPRESSED,
        );

        // when
        let result =
            verify_btc_signature_on_network(&address, message, &signature, Network::Bitcoin);

        // then
        assert!(result.is_ok(), "verifier rejected: {:?}", result);
    }

    /// Trezor / Electrum convention: header 39–42 with a P2WPKH address.
    #[test]
    fn verify_accepts_trezor_style_p2wpkh_hint_header() {
        // given
        let secret = [4u8; 32];
        let message = "native segwit signed with the segwit-hint header";
        let (address, signature) = sign_bip137(
            secret,
            message,
            WalletAddressType::P2wpkh,
            HEADER_BASE_P2WPKH_HINT,
        );

        // when
        let result =
            verify_btc_signature_on_network(&address, message, &signature, Network::Bitcoin);

        // then
        assert!(result.is_ok(), "verifier rejected: {:?}", result);
    }

    #[test]
    fn verify_accepts_compressed_header_on_p2sh_p2wpkh_address() {
        // given
        let secret = [5u8; 32];
        let message = "nested segwit with plain compressed header";
        let (address, signature) = sign_bip137(
            secret,
            message,
            WalletAddressType::P2shP2wpkh,
            HEADER_BASE_COMPRESSED,
        );

        // when
        let result =
            verify_btc_signature_on_network(&address, message, &signature, Network::Bitcoin);

        // then
        assert!(result.is_ok(), "verifier rejected: {:?}", result);
    }

    #[test]
    fn verify_accepts_p2sh_hint_header_on_p2sh_p2wpkh_address() {
        // given
        let secret = [6u8; 32];
        let message = "nested segwit with the p2sh-hint header";
        let (address, signature) = sign_bip137(
            secret,
            message,
            WalletAddressType::P2shP2wpkh,
            HEADER_BASE_P2SH_P2WPKH_HINT,
        );

        // when
        let result =
            verify_btc_signature_on_network(&address, message, &signature, Network::Bitcoin);

        // then
        assert!(result.is_ok(), "verifier rejected: {:?}", result);
    }

    #[test]
    fn verify_rejects_tampered_message() {
        // given
        let secret = [7u8; 32];
        let (address, signature) = sign_bip137(
            secret,
            "real message",
            WalletAddressType::P2wpkh,
            HEADER_BASE_COMPRESSED,
        );

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
    fn verify_rejects_signature_from_a_different_key() {
        // given
        let signer_secret = [8u8; 32];
        let victim_secret = [9u8; 32];
        let (_signer_address, signer_signature) = sign_bip137(
            signer_secret,
            "msg",
            WalletAddressType::P2wpkh,
            HEADER_BASE_COMPRESSED,
        );
        let (victim_address, _victim_signature) = sign_bip137(
            victim_secret,
            "msg",
            WalletAddressType::P2wpkh,
            HEADER_BASE_COMPRESSED,
        );

        // when
        let result = verify_btc_signature_on_network(
            &victim_address,
            "msg",
            &signer_signature,
            Network::Bitcoin,
        );

        // then
        assert!(result.is_err());
    }

    #[test]
    fn verify_rejects_uncompressed_header_against_p2wpkh_address() {
        // given
        let secret = [10u8; 32];
        let (_p2pkh_address, uncompressed_signature) = sign_bip137(
            secret,
            "msg",
            WalletAddressType::P2pkh,
            HEADER_BASE_UNCOMPRESSED,
        );
        let (p2wpkh_address, _) = sign_bip137(
            secret,
            "msg",
            WalletAddressType::P2wpkh,
            HEADER_BASE_COMPRESSED,
        );

        // when
        let result = verify_btc_signature_on_network(
            &p2wpkh_address,
            "msg",
            &uncompressed_signature,
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
    fn decode_bip137_header_rejects_out_of_range_values() {
        // given
        let too_low = 26u8;
        let too_high = 43u8;

        // when / then
        assert!(decode_bip137_header(too_low).is_err());
        assert!(decode_bip137_header(too_high).is_err());
    }

    #[test]
    fn decode_bip137_header_classifies_ranges_correctly() {
        // given / when / then
        assert_eq!(decode_bip137_header(27).unwrap(), (0, false));
        assert_eq!(decode_bip137_header(30).unwrap(), (3, false));
        assert_eq!(decode_bip137_header(31).unwrap(), (0, true));
        assert_eq!(decode_bip137_header(34).unwrap(), (3, true));
        assert_eq!(decode_bip137_header(35).unwrap(), (0, true));
        assert_eq!(decode_bip137_header(38).unwrap(), (3, true));
        assert_eq!(decode_bip137_header(39).unwrap(), (0, true));
        assert_eq!(decode_bip137_header(42).unwrap(), (3, true));
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

    // ------------------------------------------------------------------
    // Security test helpers
    // ------------------------------------------------------------------

    fn decode_signature(signature_base64: &str) -> Vec<u8> {
        general_purpose::STANDARD
            .decode(signature_base64)
            .expect("test signature must be valid base64")
    }

    fn encode_signature(bytes: &[u8]) -> String {
        general_purpose::STANDARD.encode(bytes)
    }

    // ==================================================================
    // A. Cross-scheme confusion
    // ==================================================================

    /// Given: a real BIP-322 simple witness (~107 bytes, spec "Hello World" vector)
    /// When: it is fed directly into the BIP-137 branch
    /// Then: the 65-byte length check rejects it — cross-scheme confusion is impossible
    #[test]
    fn cross_scheme_bip322_witness_is_rejected_by_bip137_length_check() {
        // given
        let bip322_signature = "AkgwRQIhAOzyynlqt93lOKJr+wmmxIens//zPzl9tqIOua93wO6MAiBi5n5EyAcPScOjf1lAqIUIQtr3zKNeavYabHyR8eGhowEhAsfxIAMZZEKUPYWI4BruhAQjzFT8FSFSajuFwrDL1Yhy";
        let wrong_address = "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh";

        // when
        let bip137_only_result = try_verify_bip137(
            &parse_address(wrong_address, Network::Bitcoin).unwrap(),
            "Hello World",
            bip322_signature,
        );

        // then
        let err = bip137_only_result.expect_err("BIP-137 path must reject a BIP-322 witness");
        assert!(
            err.contains("expected 65-byte"),
            "expected length-mismatch error, got: {}",
            err
        );
    }

    /// Given: a valid 65-byte BIP-137 signature
    /// When: it is fed directly into the BIP-322 branch
    /// Then: the witness decoder rejects it — no accidental cross-scheme acceptance
    #[test]
    fn cross_scheme_bip137_signature_is_rejected_by_bip322_parse() {
        // given
        let secret = [11u8; 32];
        let (address, bip137_signature) = sign_bip137(
            secret,
            "msg",
            WalletAddressType::P2wpkh,
            HEADER_BASE_COMPRESSED,
        );

        // when
        let bip322_only_result = try_verify_bip322_simple(
            &parse_address(&address, Network::Bitcoin).unwrap(),
            "msg",
            &bip137_signature,
        );

        // then
        assert!(
            bip322_only_result.is_err(),
            "BIP-322 path should not accept a 65-byte BIP-137 signature"
        );
    }

    /// Given: a valid BIP-137 signature
    /// When: each branch is called directly and the full dispatcher is called
    /// Then: BIP-137 accepts, BIP-322 rejects, and the dispatcher accepts — ordering is irrelevant
    #[test]
    fn cross_scheme_ordering_does_not_change_outcome_for_valid_bip137() {
        // given
        let secret = [12u8; 32];
        let (address, signature) = sign_bip137(
            secret,
            "hello",
            WalletAddressType::P2wpkh,
            HEADER_BASE_COMPRESSED,
        );

        // when
        let full_result =
            verify_btc_signature_on_network(&address, "hello", &signature, Network::Bitcoin);
        let bip322_result = try_verify_bip322_simple(
            &parse_address(&address, Network::Bitcoin).unwrap(),
            "hello",
            &signature,
        );
        let bip137_result = try_verify_bip137(
            &parse_address(&address, Network::Bitcoin).unwrap(),
            "hello",
            &signature,
        );

        // then
        assert!(full_result.is_ok());
        assert!(
            bip322_result.is_err(),
            "BIP-322 must not accept a BIP-137 blob"
        );
        assert!(
            bip137_result.is_ok(),
            "BIP-137 must accept its own signature"
        );
    }

    // ==================================================================
    // B. BIP-137 recovery-id and header manipulation
    // ==================================================================

    /// Given: a valid BIP-137 signature with a known recovery id
    /// When: the recovery id in the header is mutated to each of the other 3 values
    /// Then: every mutation is rejected, because a different pubkey is recovered
    #[test]
    fn verify_rejects_wrong_recovery_id_within_compressed_range() {
        // given
        let secret = [13u8; 32];
        let message = "rec-id-flip";
        let (address, signature) = sign_bip137(
            secret,
            message,
            WalletAddressType::P2wpkh,
            HEADER_BASE_COMPRESSED,
        );
        let mut raw = decode_signature(&signature);
        let original_header = raw[0];
        let original_offset = original_header - HEADER_BASE_COMPRESSED;

        // when / then
        const WRONG_RECOVERY_OFFSETS: [u8; 3] = [1, 2, 3];
        for wrong in WRONG_RECOVERY_OFFSETS {
            let mutated_offset = (original_offset + wrong) % 4;
            raw[0] = HEADER_BASE_COMPRESSED + mutated_offset;
            let mutated = encode_signature(&raw);

            let result =
                verify_btc_signature_on_network(&address, message, &mutated, Network::Bitcoin);
            assert!(
                result.is_err(),
                "flipped rec-id offset {} must reject (original offset {})",
                wrong,
                original_offset
            );
        }
    }

    /// Given: a BIP-137 signature made with header base 31
    /// When: the header base is rewritten to 35 and 39 (same rec_id, same compressed flag)
    /// Then: all three variants verify against the same address — the address-type hint is advisory, not authoritative
    #[test]
    fn equivalent_compressed_header_ranges_all_verify_against_same_address() {
        // given
        let secret = [14u8; 32];
        let message = "header-range-equivalence";
        let (address, baseline_signature) = sign_bip137(
            secret,
            message,
            WalletAddressType::P2wpkh,
            HEADER_BASE_COMPRESSED,
        );
        let baseline_bytes = decode_signature(&baseline_signature);
        let baseline_offset = baseline_bytes[0] - HEADER_BASE_COMPRESSED;

        // when / then
        const EQUIVALENT_BASES: [u8; 3] = [
            HEADER_BASE_COMPRESSED,
            HEADER_BASE_P2SH_P2WPKH_HINT,
            HEADER_BASE_P2WPKH_HINT,
        ];
        for base in EQUIVALENT_BASES {
            let mut rewritten = baseline_bytes.clone();
            rewritten[0] = base + baseline_offset;
            let rewritten_signature = encode_signature(&rewritten);

            let result = verify_btc_signature_on_network(
                &address,
                message,
                &rewritten_signature,
                Network::Bitcoin,
            );
            assert!(
                result.is_ok(),
                "header base {} must verify as {}: {:?}",
                base,
                HEADER_BASE_COMPRESSED,
                result
            );
        }
    }

    /// Given: header byte values outside the BIP-137 range (0, 26, 43, 255)
    /// When: decode_bip137_header is called on each
    /// Then: every value is rejected
    #[test]
    fn decode_bip137_header_rejects_zero_and_max_values() {
        // given
        const OUT_OF_RANGE_HEADERS: [u8; 4] = [0, 26, 43, 255];

        // when / then
        for header in OUT_OF_RANGE_HEADERS {
            assert!(
                decode_bip137_header(header).is_err(),
                "header {} must be rejected",
                header
            );
        }
    }

    /// Given: a valid 65-byte BIP-137 signature
    /// When: the payload is truncated to 64 bytes or extended to 66 bytes
    /// Then: both variants are rejected by the length check
    #[test]
    fn verify_rejects_truncated_signature_payload() {
        // given
        let secret = [15u8; 32];
        let (address, signature) = sign_bip137(
            secret,
            "msg",
            WalletAddressType::P2wpkh,
            HEADER_BASE_COMPRESSED,
        );
        let raw = decode_signature(&signature);

        // when
        let short = encode_signature(&raw[..raw.len() - 1]);
        let long = {
            let mut v = raw.clone();
            v.push(0u8);
            encode_signature(&v)
        };

        // then
        assert!(
            verify_btc_signature_on_network(&address, "msg", &short, Network::Bitcoin).is_err()
        );
        assert!(verify_btc_signature_on_network(&address, "msg", &long, Network::Bitcoin).is_err());
    }

    // ==================================================================
    // C. ECDSA malleability and non-canonical signatures
    // ==================================================================

    /// secp256k1 group order N, big-endian. Used by the test to manually
    /// compute the malleated twin `(r, N-s)`.
    const SECP256K1_ORDER_BYTES: [u8; 32] = [
        0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF,
        0xFE, 0xBA, 0xAE, 0xDC, 0xE6, 0xAF, 0x48, 0xA0, 0x3B, 0xBF, 0xD2, 0x5E, 0x8C, 0xD0, 0x36,
        0x41, 0x41,
    ];

    /// Computes `(N - s) mod N` on a 32-byte big-endian scalar.
    fn negate_s(s_bytes: &[u8; 32]) -> [u8; 32] {
        let mut n = SECP256K1_ORDER_BYTES;
        let mut borrow = 0i16;
        for i in (0..32).rev() {
            let lhs = n[i] as i16;
            let rhs = s_bytes[i] as i16 + borrow;
            let diff = lhs - rhs;
            if diff < 0 {
                n[i] = (diff + 256) as u8;
                borrow = 1;
            } else {
                n[i] = diff as u8;
                borrow = 0;
            }
        }
        n
    }

    /// Flipping the y-parity of the recovery id is 0↔1 / 2↔3. This
    /// corresponds to "negate s" in recoverable-ECDSA malleation.
    fn flip_y_parity(rec_id: u8) -> u8 {
        rec_id ^ 1
    }

    /// Given: a valid low-s BIP-137 signature
    /// When: an attacker builds the malleated twin (r, N-s, rec_id^1)
    /// Then: the low-s canonical-form check rejects it — closes the ECDSA-malleability class
    ///
    /// Every ECDSA signature has a silent twin with the same key and
    /// message. Rejecting high-s matches Bitcoin Core `verifymessage` and
    /// BIP-146.
    #[test]
    fn verify_rejects_high_s_malleated_signature() {
        // given
        const S_COMPONENT_OFFSET: usize = 33;
        const S_COMPONENT_END: usize = 65;
        let secret = [16u8; 32];
        let message = "malleate me";
        let (address, signature) = sign_bip137(
            secret,
            message,
            WalletAddressType::P2wpkh,
            HEADER_BASE_COMPRESSED,
        );
        let mut raw = decode_signature(&signature);
        let original_header = raw[0];
        let original_rec_id = original_header - HEADER_BASE_COMPRESSED;

        let mut s_bytes = [0u8; 32];
        s_bytes.copy_from_slice(&raw[S_COMPONENT_OFFSET..S_COMPONENT_END]);
        let negated_s = negate_s(&s_bytes);

        raw[S_COMPONENT_OFFSET..S_COMPONENT_END].copy_from_slice(&negated_s);
        raw[0] = HEADER_BASE_COMPRESSED + flip_y_parity(original_rec_id);
        let malleated = encode_signature(&raw);

        // when
        let result =
            verify_btc_signature_on_network(&address, message, &malleated, Network::Bitcoin);

        // then
        assert!(
            result.is_err(),
            "high-s malleated twin must be rejected by the low-s canonical-form check"
        );
    }

    /// Given: the boundary s values zero, exactly N/2, and N/2 + 1
    /// When: is_low_s is evaluated on each
    /// Then: zero and N/2 are accepted; N/2 + 1 is rejected
    #[test]
    fn is_low_s_classifies_boundary_values() {
        // given
        let zero = [0u8; 32];
        let exact_half = SECP256K1_HALF_ORDER_BE;
        let mut just_above_half = SECP256K1_HALF_ORDER_BE;
        const LAST_BYTE: usize = 31;
        just_above_half[LAST_BYTE] += 1;

        // when / then
        assert!(is_low_s(&zero), "zero is trivially low-s");
        assert!(is_low_s(&exact_half), "exactly N/2 is low-s");
        assert!(!is_low_s(&just_above_half), "N/2 + 1 must be rejected");
    }

    /// Given: a valid signature with its 32-byte r component zeroed
    /// When: the verifier runs
    /// Then: the signature is rejected
    #[test]
    fn verify_rejects_zero_r_component() {
        // given
        let secret = [17u8; 32];
        let (address, signature) = sign_bip137(
            secret,
            "msg",
            WalletAddressType::P2wpkh,
            HEADER_BASE_COMPRESSED,
        );
        let mut raw = decode_signature(&signature);
        for byte in raw.iter_mut().take(33).skip(1) {
            *byte = 0;
        }

        // when
        let result = verify_btc_signature_on_network(
            &address,
            "msg",
            &encode_signature(&raw),
            Network::Bitcoin,
        );

        // then
        assert!(result.is_err(), "r=0 must be rejected");
    }

    /// Given: a valid signature with its 32-byte s component zeroed
    /// When: the verifier runs
    /// Then: the signature is rejected
    #[test]
    fn verify_rejects_zero_s_component() {
        // given
        let secret = [18u8; 32];
        let (address, signature) = sign_bip137(
            secret,
            "msg",
            WalletAddressType::P2wpkh,
            HEADER_BASE_COMPRESSED,
        );
        let mut raw = decode_signature(&signature);
        for byte in raw.iter_mut().take(65).skip(33) {
            *byte = 0;
        }

        // when
        let result = verify_btc_signature_on_network(
            &address,
            "msg",
            &encode_signature(&raw),
            Network::Bitcoin,
        );

        // then
        assert!(result.is_err(), "s=0 must be rejected");
    }

    /// Given: a valid signature with a single byte flipped inside r
    /// When: the verifier runs
    /// Then: the signature is rejected
    #[test]
    fn verify_rejects_flipped_r_byte() {
        // given
        let secret = [19u8; 32];
        let (address, signature) = sign_bip137(
            secret,
            "msg",
            WalletAddressType::P2wpkh,
            HEADER_BASE_COMPRESSED,
        );
        let mut raw = decode_signature(&signature);
        const R_MIDDLE_BYTE_INDEX: usize = 10;
        raw[R_MIDDLE_BYTE_INDEX] ^= 0xFF;

        // when
        let result = verify_btc_signature_on_network(
            &address,
            "msg",
            &encode_signature(&raw),
            Network::Bitcoin,
        );

        // then
        assert!(result.is_err());
    }

    /// Given: a valid signature with a single byte flipped inside s
    /// When: the verifier runs
    /// Then: the signature is rejected
    #[test]
    fn verify_rejects_flipped_s_byte() {
        // given
        let secret = [20u8; 32];
        let (address, signature) = sign_bip137(
            secret,
            "msg",
            WalletAddressType::P2wpkh,
            HEADER_BASE_COMPRESSED,
        );
        let mut raw = decode_signature(&signature);
        const S_MIDDLE_BYTE_INDEX: usize = 50;
        raw[S_MIDDLE_BYTE_INDEX] ^= 0xFF;

        // when
        let result = verify_btc_signature_on_network(
            &address,
            "msg",
            &encode_signature(&raw),
            Network::Bitcoin,
        );

        // then
        assert!(result.is_err());
    }

    // ==================================================================
    // D. Cross-address-type replay at verifier layer (SIWB-class)
    // ==================================================================

    /// Given: a compressed-key signature valid for the P2WPKH derivation of key K
    /// When: the same signature is submitted against the P2PKH derivation of the same K
    /// Then: the verifier accepts (both addresses hash to the same pubkey hash) — app-layer `address=` binding is what blocks replay
    ///
    /// Documented behaviour, not a bug. If this test ever starts failing,
    /// the verifier has moved to address-scoped recovery, which tightens
    /// the model but also breaks wallets emitting ambiguous header bytes —
    /// any such change must come with a threat-model review.
    #[test]
    fn verifier_accepts_same_key_cross_derivation_p2wpkh_to_p2pkh_replay() {
        // given
        let secret = [21u8; 32];
        let message = "same key two addresses";
        let (_p2wpkh_address, p2wpkh_signature) = sign_bip137(
            secret,
            message,
            WalletAddressType::P2wpkh,
            HEADER_BASE_COMPRESSED,
        );
        let (p2pkh_address, _p2pkh_signature) = sign_bip137(
            secret,
            message,
            WalletAddressType::P2pkh,
            HEADER_BASE_COMPRESSED,
        );

        // when
        let result = verify_btc_signature_on_network(
            &p2pkh_address,
            message,
            &p2wpkh_signature,
            Network::Bitcoin,
        );

        // then
        assert!(
            result.is_ok(),
            "Documented: same-key cross-derivation replay IS accepted by the verifier. \
             Protection comes from `address=` in the canonical challenge."
        );
    }

    /// Given: a compressed-key signature valid for the P2WPKH derivation of key K
    /// When: the same signature is submitted against the P2SH-P2WPKH derivation of the same K
    /// Then: the verifier accepts — same rationale as the P2PKH variant, app-layer `address=` binding is the real defense
    #[test]
    fn verifier_accepts_same_key_cross_derivation_p2wpkh_to_p2sh_p2wpkh_replay() {
        // given
        let secret = [22u8; 32];
        let message = "same key nested segwit derivation";
        let (_p2wpkh_address, p2wpkh_signature) = sign_bip137(
            secret,
            message,
            WalletAddressType::P2wpkh,
            HEADER_BASE_COMPRESSED,
        );
        let (p2sh_address, _p2sh_signature) = sign_bip137(
            secret,
            message,
            WalletAddressType::P2shP2wpkh,
            HEADER_BASE_COMPRESSED,
        );

        // when
        let result = verify_btc_signature_on_network(
            &p2sh_address,
            message,
            &p2wpkh_signature,
            Network::Bitcoin,
        );

        // then
        assert!(
            result.is_ok(),
            "Documented: same-key P2WPKH↔P2SH-P2WPKH replay IS accepted at the verifier."
        );
    }

    // ==================================================================
    // E. BIP-322 witness-level attacks
    // ==================================================================

    /// Given: the taproot "Hello World" BIP-322 spec vector (address, message, signature)
    /// When: the verifier runs
    /// Then: the signature verifies via the Schnorr path
    ///
    /// Spec: https://github.com/bitcoin/bips/blob/master/bip-0322.mediawiki
    #[test]
    fn verify_accepts_bip322_simple_spec_p2tr_vector() {
        // given
        let address = "bc1ppv609nr0vr25u07u95waq5lucwfm6tde4nydujnu8npg4q75mr5sxq8lt3";
        let message = "Hello World";
        let signature = "AUHd69PrJQEv+oKTfZ8l+WROBHuy9HKrbFCJu7U1iK2iiEy1vMU5EfMtjc+VSHM7aU0SDbak5IUZRVno2P5mjSafAQ==";

        // when
        let result = verify_btc_signature_on_network(address, message, signature, Network::Bitcoin);

        // then
        assert!(result.is_ok(), "taproot spec vector failed: {:?}", result);
    }

    /// Given: the taproot spec signature paired with a modified message
    /// When: the verifier runs
    /// Then: the Schnorr check fails, call rejected
    #[test]
    fn verify_rejects_bip322_simple_p2tr_vector_with_tampered_message() {
        // given
        let address = "bc1ppv609nr0vr25u07u95waq5lucwfm6tde4nydujnu8npg4q75mr5sxq8lt3";
        let signature = "AUHd69PrJQEv+oKTfZ8l+WROBHuy9HKrbFCJu7U1iK2iiEy1vMU5EfMtjc+VSHM7aU0SDbak5IUZRVno2P5mjSafAQ==";

        // when
        let result =
            verify_btc_signature_on_network(address, "Goodbye World", signature, Network::Bitcoin);

        // then
        assert!(result.is_err());
    }

    /// Given: a valid BIP-322 P2WPKH witness with a single byte flipped in the pubkey element
    /// When: the verifier runs
    /// Then: verification fails — the pubkey-to-address binding is part of what bip322 checks
    #[test]
    fn verify_rejects_bip322_witness_with_mutated_pubkey_byte() {
        // given
        let address = "bc1q9vza2e8x573nczrlzms0wvx3gsqjx7vavgkx0l";
        let message = "Hello World";
        let valid_signature = "AkgwRQIhAOzyynlqt93lOKJr+wmmxIens//zPzl9tqIOua93wO6MAiBi5n5EyAcPScOjf1lAqIUIQtr3zKNeavYabHyR8eGhowEhAsfxIAMZZEKUPYWI4BruhAQjzFT8FSFSajuFwrDL1Yhy";

        let mut raw = decode_signature(valid_signature);
        const PUBKEY_BYTE_OFFSET: usize = 80; // in the tail of the witness
        raw[PUBKEY_BYTE_OFFSET] ^= 0xFF;
        let mutated = encode_signature(&raw);

        // when
        let result = verify_btc_signature_on_network(address, message, &mutated, Network::Bitcoin);

        // then
        assert!(result.is_err(), "witness mutation must be rejected");
    }

    /// Given: a signature payload that isn't valid base64
    /// When: the verifier runs
    /// Then: both branches reject cleanly without panicking
    #[test]
    fn verify_rejects_bip322_signature_with_malformed_base64() {
        // given
        let address = "bc1q9vza2e8x573nczrlzms0wvx3gsqjx7vavgkx0l";
        let malformed = "!!!not-base64!!!";

        // when
        let result = verify_btc_signature_on_network(address, "msg", malformed, Network::Bitcoin);

        // then
        assert!(result.is_err());
    }

    /// Given: a 32-byte payload of zeros (neither a witness nor a full BIP-137 signature)
    /// When: the verifier runs
    /// Then: both branches reject
    #[test]
    fn verify_rejects_bip322_signature_truncated_to_32_bytes() {
        // given
        let address = "bc1q9vza2e8x573nczrlzms0wvx3gsqjx7vavgkx0l";
        let truncated = encode_signature(&[0u8; 32]);

        // when
        let result = verify_btc_signature_on_network(address, "msg", &truncated, Network::Bitcoin);

        // then
        assert!(result.is_err());
    }

    // ==================================================================
    // F. Message framing edge cases
    // ==================================================================

    /// Given: a signature produced for the empty string message
    /// When: the verifier runs against the empty message and the signature
    /// Then: the signature verifies
    #[test]
    fn verify_accepts_empty_message_round_trip() {
        // given
        let secret = [23u8; 32];
        let (address, signature) = sign_bip137(
            secret,
            "",
            WalletAddressType::P2wpkh,
            HEADER_BASE_COMPRESSED,
        );

        // when
        let result = verify_btc_signature_on_network(&address, "", &signature, Network::Bitcoin);

        // then
        assert!(
            result.is_ok(),
            "empty message should round-trip: {:?}",
            result
        );
    }

    /// Given: a message containing CRLF, tab, SOH (0x01), and NUL (0x00) bytes
    /// When: the verifier runs
    /// Then: the signature verifies — the verifier treats the message as opaque bytes
    #[test]
    fn verify_accepts_message_with_control_bytes() {
        // given
        let secret = [24u8; 32];
        let message = "line1\r\nline2\tand\x01control\x00bytes";
        let (address, signature) = sign_bip137(
            secret,
            message,
            WalletAddressType::P2wpkh,
            HEADER_BASE_COMPRESSED,
        );

        // when
        let result =
            verify_btc_signature_on_network(&address, message, &signature, Network::Bitcoin);

        // then
        assert!(
            result.is_ok(),
            "control bytes should round-trip: {:?}",
            result
        );
    }

    /// Given: a message containing multi-byte UTF-8 (Latin accents, kanji, emoji)
    /// When: the verifier runs
    /// Then: the signature verifies — non-ASCII payloads round-trip correctly
    #[test]
    fn verify_accepts_message_with_multi_byte_utf8() {
        // given
        let secret = [25u8; 32];
        let message = "Hëllo Wörld — こんにちは 𝐀𝐁𝐂";
        let (address, signature) = sign_bip137(
            secret,
            message,
            WalletAddressType::P2wpkh,
            HEADER_BASE_COMPRESSED,
        );

        // when
        let result =
            verify_btc_signature_on_network(&address, message, &signature, Network::Bitcoin);

        // then
        assert!(
            result.is_ok(),
            "multi-byte UTF-8 should round-trip: {:?}",
            result
        );
    }

    /// Given: lengths 252, 253, and 254 — spanning the u8 → u16 varint boundary
    /// When: varint_encode is called on each
    /// Then: 252 encodes as a single byte; 253+ switches to the `0xfd` prefix format
    #[test]
    fn varint_encode_handles_boundary_between_u8_and_u16() {
        // given
        const BOUNDARY_JUST_BELOW: usize = 252;
        const BOUNDARY_JUST_AT: usize = 253;
        const BOUNDARY_JUST_ABOVE: usize = 254;

        // when
        let below = varint_encode(BOUNDARY_JUST_BELOW);
        let at = varint_encode(BOUNDARY_JUST_AT);
        let above = varint_encode(BOUNDARY_JUST_ABOVE);

        // then
        assert_eq!(below, vec![252]);
        assert_eq!(at, vec![0xfd, 253, 0]);
        assert_eq!(above, vec![0xfd, 254, 0]);
    }

    /// Given: lengths 65_535 and 65_536 — spanning the u16 → u32 varint boundary
    /// When: varint_encode is called on each
    /// Then: 65_535 uses the `0xfd` u16 prefix; 65_536 switches to the `0xfe` u32 prefix
    #[test]
    fn varint_encode_handles_boundary_between_u16_and_u32() {
        // given
        const BOUNDARY_JUST_BELOW: usize = 65_535;
        const BOUNDARY_JUST_ABOVE: usize = 65_536;

        // when
        let below = varint_encode(BOUNDARY_JUST_BELOW);
        let above = varint_encode(BOUNDARY_JUST_ABOVE);

        // then
        assert_eq!(below, vec![0xfd, 0xff, 0xff]);
        assert_eq!(above, vec![0xfe, 0x00, 0x00, 0x01, 0x00]);
    }

    /// Given: a 2 KB message that pushes the message-length varint into the u16 encoding path
    /// When: the verifier runs
    /// Then: the signature verifies — message framing handles non-u8 varints
    #[test]
    fn verify_accepts_long_message_across_varint_boundary() {
        // given
        let secret = [26u8; 32];
        const LONG_MESSAGE_LEN: usize = 2_048;
        let message: String = std::iter::repeat('x').take(LONG_MESSAGE_LEN).collect();
        let (address, signature) = sign_bip137(
            secret,
            &message,
            WalletAddressType::P2wpkh,
            HEADER_BASE_COMPRESSED,
        );

        // when
        let result =
            verify_btc_signature_on_network(&address, &message, &signature, Network::Bitcoin);

        // then
        assert!(
            result.is_ok(),
            "long message should round-trip: {:?}",
            result
        );
    }

    // ==================================================================
    // G. Address-layer defenses
    // ==================================================================

    /// Given: a signature produced for a mainnet address
    /// When: the verifier is called with `Network::Testnet4`
    /// Then: `require_network` rejects before any crypto runs
    #[test]
    fn verify_rejects_mainnet_signature_on_testnet_network() {
        // given
        let secret = [27u8; 32];
        let (mainnet_address, signature) = sign_bip137(
            secret,
            "msg",
            WalletAddressType::P2wpkh,
            HEADER_BASE_COMPRESSED,
        );

        // when
        let result =
            verify_btc_signature_on_network(&mainnet_address, "msg", &signature, Network::Testnet4);

        // then
        let err = result.expect_err("mainnet address must be rejected on testnet network");
        assert_eq!(err.code, error_codes::INVALID_SIGNATURE.code);
    }

    /// Given: a bech32 address with a corrupted final character (invalid checksum)
    /// When: the verifier parses the address
    /// Then: parsing fails, call rejected
    #[test]
    fn verify_rejects_address_with_invalid_checksum() {
        // given
        let bad_checksum_address = "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlZ";

        // when
        let result =
            verify_btc_signature_on_network(bad_checksum_address, "msg", "AAAA", Network::Bitcoin);

        // then
        assert!(result.is_err());
    }

    /// Given: an empty string as the address input
    /// When: the verifier parses the address
    /// Then: parsing fails, call rejected
    #[test]
    fn verify_rejects_empty_address() {
        // given
        let empty = "";

        // when
        let result = verify_btc_signature_on_network(empty, "msg", "AAAA", Network::Bitcoin);

        // then
        assert!(result.is_err());
    }

    /// Given: a bech32 address with mixed upper-and-lower case (BIP-173 forbids this)
    /// When: the verifier parses the address
    /// Then: parsing fails, call rejected
    #[test]
    fn verify_rejects_bech32_address_with_mixed_case() {
        // given
        let mixed_case = "BC1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh";

        // when
        let result = verify_btc_signature_on_network(mixed_case, "msg", "AAAA", Network::Bitcoin);

        // then
        assert!(result.is_err());
    }

    /// Given: a 65-byte BIP-137 signature and a P2TR (taproot) address
    /// When: the verifier tries both branches
    /// Then: both reject — BIP-322 can't consensus-decode 65 bytes as a witness, BIP-137 doesn't support taproot
    #[test]
    fn verify_rejects_bip137_signature_against_p2tr_address() {
        // given
        let secret = [28u8; 32];
        let (_throwaway_addr, signature) = sign_bip137(
            secret,
            "msg",
            WalletAddressType::P2wpkh,
            HEADER_BASE_COMPRESSED,
        );
        let p2tr_address = "bc1ppv609nr0vr25u07u95waq5lucwfm6tde4nydujnu8npg4q75mr5sxq8lt3";

        // when
        let result =
            verify_btc_signature_on_network(p2tr_address, "msg", &signature, Network::Bitcoin);

        // then
        assert!(result.is_err());
    }

    // ==================================================================
    // H. Resource safety
    // ==================================================================

    /// Given: a 1 MB signature payload
    /// When: the verifier runs
    /// Then: the call rejects cleanly without panicking or consuming unbounded cycles
    #[test]
    fn verify_rejects_oversized_signature_payload_without_panic() {
        // given
        let address = "bc1q9vza2e8x573nczrlzms0wvx3gsqjx7vavgkx0l";
        const ONE_MB: usize = 1_048_576;
        let oversized = encode_signature(&vec![0u8; ONE_MB]);

        // when
        let result = verify_btc_signature_on_network(address, "msg", &oversized, Network::Bitcoin);

        // then
        assert!(result.is_err());
    }

    /// Given: a 256 KB message signed end-to-end
    /// When: the verifier runs
    /// Then: the signature verifies, confirming framing and hashing are not length-bounded
    #[test]
    fn verify_handles_very_long_message_without_panic() {
        // given
        let secret = [29u8; 32];
        const MESSAGE_LEN: usize = 262_144; // 256 KB
        let message: String = std::iter::repeat('a').take(MESSAGE_LEN).collect();
        let (address, signature) = sign_bip137(
            secret,
            &message,
            WalletAddressType::P2wpkh,
            HEADER_BASE_COMPRESSED,
        );

        // when
        let result =
            verify_btc_signature_on_network(&address, &message, &signature, Network::Bitcoin);

        // then
        assert!(
            result.is_ok(),
            "256 KB message should still verify: {:?}",
            result
        );
    }

    /// Given: a signature string containing a non-ASCII codepoint inside otherwise-valid base64
    /// When: the verifier runs
    /// Then: base64 decoding fails cleanly, call rejected
    #[test]
    fn verify_rejects_base64_with_non_ascii_characters() {
        // given
        let address = "bc1q9vza2e8x573nczrlzms0wvx3gsqjx7vavgkx0l";
        let non_ascii = "AAAA\u{00E9}BBBB";

        // when
        let result = verify_btc_signature_on_network(address, "msg", non_ascii, Network::Bitcoin);

        // then
        assert!(result.is_err());
    }
}

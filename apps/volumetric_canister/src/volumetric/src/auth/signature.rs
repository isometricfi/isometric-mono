use base64::prelude::*;
use bitcoin::address::{AddressData, NetworkUnchecked};
use bitcoin::hashes::{hash160, sha256, Hash, HashEngine};
use bitcoin::key::TapTweak;
use bitcoin::secp256k1::ecdsa::{RecoverableSignature, RecoveryId};
use bitcoin::secp256k1::{Message, PublicKey, Secp256k1};
use bitcoin::{Address, CompressedPublicKey, Network, ScriptBuf, Witness};

use crate::errors::{error_codes, VolumetricError};
use crate::ic;
use crate::storage::{BtcNetwork, Config};

const LEGACY_SIGNATURE_LENGTH: usize = 65;
const BTC_MESSAGE_PREFIX: &[u8] = b"\x18Bitcoin Signed Message:\n";

// Header byte ranges for BIP-137 recoverable ECDSA signatures.
// Wallets (notably UniSat) often emit compressed-range headers (31-34) even for
// segwit addresses, so the address-type hint in the header is treated as advisory.
const LEGACY_HEADER_MIN: u8 = 27;
const LEGACY_HEADER_UNCOMPRESSED_MAX_PLUS_ONE: u8 = 31; // 27..=30 → uncompressed
const LEGACY_HEADER_MAX_PLUS_ONE: u8 = 43; // 31..=42 → compressed (any address-type hint)
const BIP137_RECOVERY_IDS_PER_RANGE: u8 = 4;

// Upper bound on the base64-encoded signature accepted at the verifier
// boundary. BIP-322 simple witnesses are ~150 bytes and BIP-137 signatures
// are exactly 88 bytes in base64; 1 KiB caps cycle spend on oversized inputs
// before any base64 decode or consensus decode runs.
const MAX_SIGNATURE_BASE64_LEN: usize = 1024;

// Upper bound on the message bytes accepted at the verifier boundary. The
// canonical challenge built by `build_challenge_message` is well under 1 KiB
// in practice; 4 KiB leaves headroom for future action fields while bounding
// the cost of `legacy_message_hash` (double-SHA256 over the whole payload).
const MAX_MESSAGE_BYTES: usize = 4096;

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

/// Same as [`verify_btc_signature`] but takes an explicit network so the
/// verifier can be unit-tested without touching stable storage.
///
/// Tries BIP-322 simple first, then BIP-137 legacy ECDSA. The first scheme
/// that cryptographically verifies returns `Ok`. Both per-scheme errors are
/// included in the failure message when neither accepts.
///
/// Taproot (P2TR) is handled by both paths: Phantom-style wallets produce a
/// BIP-322 Schnorr witness; UniSat-style wallets produce a BIP-137 ECDSA
/// signature from the BIP-86 internal key.
pub fn verify_btc_signature_on_network(
    address: &str,
    message: &str,
    signature_base64: &str,
    network: Network,
) -> Result<(), VolumetricError> {
    if signature_base64.len() > MAX_SIGNATURE_BASE64_LEN {
        return Err(VolumetricError::from_def(
            error_codes::INVALID_SIGNATURE,
            Some(&format!(
                "signature exceeds maximum base64 length of {} bytes",
                MAX_SIGNATURE_BASE64_LEN
            )),
            None,
        ));
    }

    if message.len() > MAX_MESSAGE_BYTES {
        return Err(VolumetricError::from_def(
            error_codes::INVALID_SIGNATURE,
            Some(&format!(
                "message exceeds maximum length of {} bytes",
                MAX_MESSAGE_BYTES
            )),
            None,
        ));
    }

    let btc_address = parse_address(address, network)?;

    let bip322_err = match try_verify_bip322_simple(&btc_address, message, signature_base64) {
        Ok(()) => return Ok(()),
        Err(e) => e,
    };

    let bip137_err = match try_verify_bip137(&btc_address, message, signature_base64) {
        Ok(()) => return Ok(()),
        Err(e) => e,
    };

    // Per-scheme failure reasons are logged to the canister log (visible to
    // controllers) but intentionally omitted from the caller-facing error to
    // avoid helping unauthenticated probes fingerprint input handling.
    ic::log(&format!(
        "btc signature verification failed for address {}: bip322={}; bip137={}",
        address, bip322_err, bip137_err
    ));

    Err(VolumetricError::from_def(
        error_codes::INVALID_SIGNATURE,
        None,
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

// Delegates to the `bip322` crate for P2WPKH and P2TR witnesses. For P2SH-P2WPKH
// (Nested SegWit, used by Xverse for its "payment" address), the crate's
// `verify_full_p2wpkh(is_p2sh=true)` branch destructures
// `AddressData::P2sh { script_hash: _ }` and never checks that
// `hash160(new_p2wpkh(witness_pubkey.wpubkey_hash()))` equals the address's
// script_hash, so a foreign-key witness would otherwise verify against any
// P2SH-P2WPKH address. We close that gap by binding the witness pubkey to the
// script_hash ourselves before delegating to the crate's signature check.
fn try_verify_bip322_simple(
    btc_address: &Address,
    message: &str,
    signature_base64: &str,
) -> Result<(), String> {
    if let AddressData::P2sh { script_hash } = btc_address.to_address_data() {
        bind_p2sh_p2wpkh_witness_pubkey(*script_hash.as_raw_hash(), signature_base64)?;
    }

    bip322::verify_simple_encoded(&btc_address.to_string(), message, signature_base64)
        .map_err(|e| format!("{}", e))
}

// Decodes the BIP-322 simple witness, extracts the compressed pubkey, and
// requires that `hash160(OP_0 <hash160(pubkey)>)` equals the P2SH address's
// script_hash. Without this binding, the bip322 0.0.10 crate accepts any
// self-consistent (sig, pubkey) pair for a P2SH address.
fn bind_p2sh_p2wpkh_witness_pubkey(
    expected_script_hash: hash160::Hash,
    signature_base64: &str,
) -> Result<(), String> {
    let signature_bytes = BASE64_STANDARD
        .decode(signature_base64)
        .map_err(|e| format!("base64 decode failed: {}", e))?;

    let witness: Witness = bitcoin::consensus::deserialize(&signature_bytes)
        .map_err(|e| format!("failed to decode BIP-322 simple witness: {}", e))?;

    if witness.len() != 2 {
        return Err(format!(
            "BIP-322 P2SH-P2WPKH witness must have exactly 2 stack items \
             (signature, compressed_pubkey); got {}",
            witness.len()
        ));
    }

    let pubkey_bytes = witness
        .iter()
        .nth(1)
        .expect("len==2 implies index 1 exists");
    let compressed = CompressedPublicKey::from_slice(pubkey_bytes)
        .map_err(|e| format!("invalid compressed pubkey in BIP-322 witness: {}", e))?;

    let redeem_script = ScriptBuf::new_p2wpkh(&compressed.wpubkey_hash());
    let recovered_script_hash = hash160::Hash::hash(redeem_script.as_bytes());

    if recovered_script_hash != expected_script_hash {
        return Err(
            "BIP-322 witness pubkey does not derive the address's P2SH script_hash \
             (witness key is not the one committed by the P2SH-P2WPKH address)"
                .into(),
        );
    }

    Ok(())
}

// BIP-137 legacy signed-message verification. The header's address-type hint
// is ignored; the recovered key is matched against the caller's actual address
// type. This accepts UniSat's behaviour of emitting headers 31-34 for any
// address type, including native segwit and taproot.
fn try_verify_bip137(
    btc_address: &Address,
    message: &str,
    signature_base64: &str,
) -> Result<(), String> {
    let (recovered_key, is_compressed) = recover_bip137_ecdsa_key(signature_base64, message)?;
    let recovered_pubkey_hash = hash160_bip137_pubkey(&recovered_key, is_compressed);
    let secp = Secp256k1::verification_only();

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
                    "P2WPKH addresses require a compressed-key signature (header 31-42)".into(),
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
                    "P2SH-P2WPKH addresses require a compressed-key signature (header 31-42)"
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
        AddressData::Segwit { witness_program }
            if witness_program.version().to_num() == 1 && witness_program.program().len() == 32 =>
        {
            if !is_compressed {
                return Err(
                    "P2TR addresses require a compressed-key signature (header 31-42)".into(),
                );
            }
            // BIP-86 keypath-only: output key = tap_tweak(internal_key, ∅).
            // Script-path taproot addresses are indistinguishable from key-path
            // on-chain, so a mismatch here may mean either an invalid signature
            // or a script-path P2TR address that this verifier does not support.
            let (recovered_xonly, _parity) = recovered_key.x_only_public_key();
            let (tweaked, _parity) = recovered_xonly.tap_tweak(&secp, None);
            let expected =
                <[u8; 32]>::try_from(witness_program.program().as_bytes()).expect("len==32");
            if tweaked.to_x_only_public_key().serialize() != expected {
                return Err(
                    "P2TR witness program does not match the BIP-86 tap-tweaked pubkey \
                     recovered from the signature (possible causes: wrong signature, or a \
                     script-path P2TR address — only BIP-86 key-path taproot is supported)"
                        .into(),
                );
            }
            Ok(())
        }
        _ => Err("address type is not supported for BIP-137 (P2WSH / unrecognized)".into()),
    }
}

// Decodes and validates the 65-byte BIP-137 signature, then recovers the
// secp256k1 public key and returns it together with the is_compressed flag.
fn recover_bip137_ecdsa_key(
    signature_base64: &str,
    message: &str,
) -> Result<(PublicKey, bool), String> {
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
    let (recovery_offset, is_compressed) = decode_bip137_header(header)?;

    let recovery_id = RecoveryId::from_i32(recovery_offset as i32)
        .map_err(|e| format!("invalid recovery id: {}", e))?;

    let s_bytes = <&[u8; 32]>::try_from(&signature_bytes[33..65]).expect("slice is 32 bytes");
    if !is_low_s(s_bytes) {
        return Err("high-s signature rejected (non-canonical, malleable)".into());
    }

    let recoverable_sig = RecoverableSignature::from_compact(&signature_bytes[1..], recovery_id)
        .map_err(|e| format!("invalid signature: {}", e))?;

    let message_hash = legacy_message_hash(message.as_bytes());
    let secp = Secp256k1::verification_only();
    let recovered_key = secp
        .recover_ecdsa(&Message::from_digest(message_hash), &recoverable_sig)
        .map_err(|e| format!("recovery failed: {}", e))?;

    Ok((recovered_key, is_compressed))
}

fn hash160_bip137_pubkey(key: &PublicKey, is_compressed: bool) -> hash160::Hash {
    let bytes = if is_compressed {
        key.serialize().to_vec()
    } else {
        key.serialize_uncompressed().to_vec()
    };
    hash160::Hash::hash(&bytes)
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

// Returns true when s <= N/2 (canonical low-s form, required by BIP-146).
// N/2 is computed inline by right-shifting CURVE_ORDER one bit, so there
// are no magic byte literals stored in the source.
fn is_low_s(s_bytes: &[u8; 32]) -> bool {
    let order = bitcoin::secp256k1::constants::CURVE_ORDER;
    let mut carry = 0u8;
    for i in 0..32 {
        let half_byte = (order[i] >> 1) | (carry << 7);
        carry = order[i] & 1;
        match s_bytes[i].cmp(&half_byte) {
            std::cmp::Ordering::Less => return true,
            std::cmp::Ordering::Greater => return false,
            std::cmp::Ordering::Equal => continue,
        }
    }
    true
}

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
        P2tr,
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
            WalletAddressType::P2tr => {
                let (xonly, _parity) = pubkey.inner.x_only_public_key();
                Address::p2tr(&secp, xonly, None, Network::Bitcoin)
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

    /// Given: a P2PKH address and a BIP-137 ECDSA signature with a compressed header
    /// When: the verifier runs
    /// Then: the signature verifies
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

    /// Given: a P2PKH address and a BIP-137 ECDSA signature with an uncompressed header
    /// When: the verifier runs
    /// Then: the signature verifies
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

    /// Given: a P2WPKH (native segwit) address and a BIP-137 signature using the
    ///        compressed P2PKH header base (31-34) — UniSat's default signMessage behaviour
    /// When: the verifier runs
    /// Then: the signature verifies; the header hint is advisory, not authoritative
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

    /// Given: a P2WPKH address and a BIP-137 signature using the segwit hint header (39-42)
    ///        — the Trezor / Electrum convention
    /// When: the verifier runs
    /// Then: the signature verifies
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

    /// Given: a P2TR (taproot) address and a BIP-137 ECDSA signature produced from the
    ///        BIP-86 internal key — UniSat's default signMessage behaviour for taproot
    /// When: the verifier runs
    /// Then: the signature verifies via BIP-86 tap_tweak on the recovered ECDSA key
    #[test]
    fn verify_accepts_unisat_style_bip137_signature_on_p2tr_address() {
        // given
        let secret = [42u8; 32];
        let message = "taproot ecdsa signed with bip137 header";
        let (address, signature) = sign_bip137(
            secret,
            message,
            WalletAddressType::P2tr,
            HEADER_BASE_COMPRESSED,
        );

        // when
        let result =
            verify_btc_signature_on_network(&address, message, &signature, Network::Bitcoin);

        // then
        assert!(result.is_ok(), "verifier rejected: {:?}", result);
    }

    /// Given: a P2SH-P2WPKH address and a BIP-137 signature using the plain compressed header
    /// When: the verifier runs
    /// Then: the signature verifies
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

    /// Given: a P2SH-P2WPKH address and a BIP-137 signature using the P2SH hint header (35-38)
    /// When: the verifier runs
    /// Then: the signature verifies
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

    /// Given: a P2SH-P2WPKH address and a real BIP-322 simple signature produced by its
    ///        own private key — the format Xverse emits from `signMessage` for its
    ///        "payment" address
    /// When: the verifier runs
    /// Then: the signature verifies via the BIP-322 path with our pre-dispatch
    ///       script_hash binding (witness pubkey → P2WPKH redeem script → script_hash)
    #[test]
    fn verify_accepts_bip322_signature_on_p2sh_p2wpkh_address() {
        // given
        let secret = [9u8; 32];
        let message = "xverse nested segwit signs payment messages with bip322";
        let secp = Secp256k1::new();
        let secret_key = SecretKey::from_slice(&secret).unwrap();
        let private_key = PrivateKey {
            compressed: true,
            network: Network::Bitcoin.into(),
            inner: secret_key,
        };
        let compressed = CompressedPublicKey::from_private_key(&secp, &private_key).unwrap();
        let address = Address::p2shwpkh(&compressed, Network::Bitcoin);
        let signature = bip322::sign_simple_encoded(&address.to_string(), message, &private_key.to_wif())
            .expect("bip322::sign_simple_encoded should support P2SH-P2WPKH");

        // when
        let result = verify_btc_signature_on_network(
            &address.to_string(),
            message,
            &signature,
            Network::Bitcoin,
        );

        // then
        assert!(
            result.is_ok(),
            "verifier must accept a self-signed BIP-322 signature on a P2SH-P2WPKH address: {:?}",
            result
        );
    }

    /// Given: a valid address and signature, but the message submitted to the verifier differs
    /// When: the verifier runs
    /// Then: the signature is rejected
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

    /// Given: a signature produced by key A, submitted against an address derived from key B
    /// When: the verifier runs
    /// Then: the signature is rejected
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

    /// Given: a valid uncompressed-key signature, submitted against the P2WPKH address
    ///        of the same key (P2WPKH requires a compressed key)
    /// When: the verifier runs
    /// Then: the signature is rejected
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

    /// Given: the BIP-322 reference "Hello World" spec vector (P2WPKH address, message, signature)
    /// When: the verifier runs
    /// Then: the signature verifies via the BIP-322 path
    ///
    /// Spec: https://github.com/bitcoin/bips/blob/master/bip-0322.mediawiki
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

    /// Given: the BIP-322 spec signature paired with a different message
    /// When: the verifier runs
    /// Then: the signature is rejected
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

    /// Given: a 65-byte blob of zeros (not a valid ECDSA signature)
    /// When: the verifier runs
    /// Then: the signature is rejected by both paths
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

    /// Given: the header byte constants defining the four BIP-137 ranges
    /// When: decode_bip137_header is called on the minimum and maximum of each range
    /// Then: the uncompressed range (27-30) sets is_compressed=false; all compressed
    ///       ranges (31-42) set is_compressed=true; recovery_offset cycles 0-3 within each
    #[test]
    fn decode_bip137_header_classifies_ranges_correctly() {
        // given
        let uncompressed_min = HEADER_BASE_UNCOMPRESSED;
        let uncompressed_max = HEADER_BASE_COMPRESSED - 1;
        let compressed_p2pkh_min = HEADER_BASE_COMPRESSED;
        let compressed_p2pkh_max = HEADER_BASE_P2SH_P2WPKH_HINT - 1;
        let compressed_p2sh_min = HEADER_BASE_P2SH_P2WPKH_HINT;
        let compressed_p2sh_max = HEADER_BASE_P2WPKH_HINT - 1;
        let compressed_segwit_min = HEADER_BASE_P2WPKH_HINT;
        let compressed_segwit_max = HEADER_BASE_P2WPKH_HINT + 3;

        // when
        let results = [
            decode_bip137_header(uncompressed_min),
            decode_bip137_header(uncompressed_max),
            decode_bip137_header(compressed_p2pkh_min),
            decode_bip137_header(compressed_p2pkh_max),
            decode_bip137_header(compressed_p2sh_min),
            decode_bip137_header(compressed_p2sh_max),
            decode_bip137_header(compressed_segwit_min),
            decode_bip137_header(compressed_segwit_max),
        ];

        // then
        assert_eq!(results[0].clone().unwrap(), (0, false));
        assert_eq!(results[1].clone().unwrap(), (3, false));
        assert_eq!(results[2].clone().unwrap(), (0, true));
        assert_eq!(results[3].clone().unwrap(), (3, true));
        assert_eq!(results[4].clone().unwrap(), (0, true));
        assert_eq!(results[5].clone().unwrap(), (3, true));
        assert_eq!(results[6].clone().unwrap(), (0, true));
        assert_eq!(results[7].clone().unwrap(), (3, true));
    }

    /// Given: header byte values outside the BIP-137 range (0, 26, 43, 255)
    /// When: decode_bip137_header is called on each
    /// Then: every value is rejected
    #[test]
    fn decode_bip137_header_rejects_out_of_range_values() {
        // given
        let too_low = 26u8;
        let too_high = 43u8;

        // when / then
        assert!(decode_bip137_header(too_low).is_err());
        assert!(decode_bip137_header(too_high).is_err());
    }

    /// Given: a short (100-byte), medium (1000-byte), and large (100000-byte) length
    /// When: varint_encode is called on each
    /// Then: short encodes as a single byte; medium uses the 0xfd u16 prefix; large uses 0xfe
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
        let mut result = SECP256K1_ORDER_BYTES;
        let mut borrow = 0i16;
        for i in (0..32).rev() {
            let lhs = result[i] as i16;
            let rhs = s_bytes[i] as i16 + borrow;
            let diff = lhs - rhs;
            if diff < 0 {
                result[i] = (diff + 256) as u8;
                borrow = 1;
            } else {
                result[i] = diff as u8;
                borrow = 0;
            }
        }
        result
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
        const S_OFFSET: usize = 33;
        const S_END: usize = 65;
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
        s_bytes.copy_from_slice(&raw[S_OFFSET..S_END]);
        let negated_s = negate_s(&s_bytes);

        raw[S_OFFSET..S_END].copy_from_slice(&negated_s);
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

    /// Given: a victim P2SH-P2WPKH address `A_v` owned by key `K_v`, and an unrelated
    ///        attacker key `K_a`; the attacker builds a BIP-322 simple witness
    ///        `[DER(sig_A) || 0x01, pub_A]` where `sig_A` signs the BIP-143 P2WPKH
    ///        sighash that the bip322 crate will compute in its `is_p2sh=true` branch
    ///        (script_code = `p2wpkh(hash160(pub_A))`, prevout = `create_to_spend(A_v, msg).txid:0`)
    /// When: the forged witness is submitted against `A_v`
    /// Then: `verify_btc_signature_on_network` rejects it
    ///
    /// Documents a pre-dispatch security check that bypasses the `bip322` crate's
    /// `verify_full_p2wpkh(is_p2sh=true)` path. That path destructures
    /// `AddressData::P2sh { script_hash: _ }` and never enforces
    /// `hash160(new_p2wpkh(pub_A.wpubkey_hash())) == script_hash`, so a foreign key
    /// can authenticate against any P2SH-P2WPKH address. The volumetric canister
    /// must therefore skip BIP-322 for P2SH addresses and rely on the BIP-137
    /// branch, which derives the expected script hash from the recovered pubkey.
    #[test]
    fn verify_rejects_bip322_forged_witness_against_p2sh_p2wpkh_address() {
        use bitcoin::consensus::serialize;
        use bitcoin::sighash::SighashCache;
        use bitcoin::{Amount, EcdsaSighashType, Witness};

        // given
        const VICTIM_SECRET: [u8; 32] = [40u8; 32];
        const ATTACKER_SEED_START: u8 = 41;
        const BIP322_SIG_LEN_MIN: usize = 71;
        const BIP322_SIG_LEN_MAX: usize = 72;
        const SIGHASH_ALL_BYTE: u8 = EcdsaSighashType::All as u8;

        let secp = Secp256k1::new();
        let victim_sk = SecretKey::from_slice(&VICTIM_SECRET).unwrap();
        let victim_private_key = PrivateKey {
            compressed: true,
            network: Network::Bitcoin.into(),
            inner: victim_sk,
        };
        let victim_compressed =
            CompressedPublicKey::from_private_key(&secp, &victim_private_key).unwrap();
        let victim_p2sh_address = Address::p2shwpkh(&victim_compressed, Network::Bitcoin);
        let message = "withdraw all funds to attacker";

        let to_spend = bip322::create_to_spend(&victim_p2sh_address, message).unwrap();
        let to_sign_psbt = bip322::create_to_sign(&to_spend, None).unwrap();
        let unsigned_tx = to_sign_psbt.unsigned_tx;

        let mut attacker_seed = ATTACKER_SEED_START;
        let forged_signature_base64 = loop {
            let attacker_secret = [attacker_seed; 32];
            let attacker_sk = SecretKey::from_slice(&attacker_secret).unwrap();
            let attacker_private_key = PrivateKey {
                compressed: true,
                network: Network::Bitcoin.into(),
                inner: attacker_sk,
            };
            let attacker_pub = PublicKey::from_private_key(&secp, &attacker_private_key);
            let attacker_wpubkey_hash = attacker_pub.wpubkey_hash().unwrap();
            let script_code = ScriptBuf::new_p2wpkh(&attacker_wpubkey_hash);

            let sighash = SighashCache::new(unsigned_tx.clone())
                .p2wpkh_signature_hash(0, &script_code, Amount::from_sat(0), EcdsaSighashType::All)
                .unwrap();
            let sighash_msg = Message::from_digest_slice(sighash.as_ref()).unwrap();
            let ecdsa_sig = secp.sign_ecdsa(&sighash_msg, &attacker_sk);
            let mut sig_der = ecdsa_sig.serialize_der().to_vec();
            sig_der.push(SIGHASH_ALL_BYTE);

            if (BIP322_SIG_LEN_MIN..=BIP322_SIG_LEN_MAX).contains(&sig_der.len()) {
                let mut witness = Witness::new();
                witness.push(&sig_der);
                witness.push(attacker_pub.to_bytes());
                let witness_bytes = serialize(&witness);
                break general_purpose::STANDARD.encode(&witness_bytes);
            }

            attacker_seed = attacker_seed.wrapping_add(1);
            assert!(
                attacker_seed != ATTACKER_SEED_START,
                "no attacker secret produced a BIP-322-acceptable DER signature"
            );
        };

        // Sanity check: the forgery is accepted by the bip322 crate on its own,
        // confirming the construction is valid and this test actually exercises
        // the bypass. If the upstream crate ever starts rejecting this input,
        // the canister-level pre-dispatch below may no longer be needed.
        let bip322_direct_result = bip322::verify_simple_encoded(
            &victim_p2sh_address.to_string(),
            message,
            &forged_signature_base64,
        );
        assert!(
            bip322_direct_result.is_ok(),
            "bip322 crate should accept the forgery (documents the bypass): {:?}",
            bip322_direct_result
        );

        // when
        let result = verify_btc_signature_on_network(
            &victim_p2sh_address.to_string(),
            message,
            &forged_signature_base64,
            Network::Bitcoin,
        );

        // then
        assert!(
            result.is_err(),
            "verifier must reject a BIP-322 witness signed by a foreign key on a P2SH-P2WPKH address"
        );
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

    /// Given: a 65-byte BIP-137 signature signed by key K, verified against a
    ///        P2TR address derived from an unrelated key
    /// When: the verifier tries both branches
    /// Then: both reject — BIP-322 can't consensus-decode 65 bytes as a
    ///       witness, and BIP-137's tap-tweak of the recovered key does not
    ///       match the address's witness program
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

    /// Given: a 256 KB message — well above the MAX_MESSAGE_BYTES cap
    /// When: the verifier runs
    /// Then: the call is rejected at the boundary before any hashing happens,
    ///       bounding cycle spend on oversized inputs
    #[test]
    fn verify_rejects_message_above_size_cap() {
        // given
        let address = "bc1q9vza2e8x573nczrlzms0wvx3gsqjx7vavgkx0l";
        const MESSAGE_LEN_ABOVE_CAP: usize = 262_144;
        let oversized_message: String =
            std::iter::repeat('a').take(MESSAGE_LEN_ABOVE_CAP).collect();
        let dummy_signature = encode_signature(&[0u8; LEGACY_SIGNATURE_LENGTH]);

        // when
        let result = verify_btc_signature_on_network(
            address,
            &oversized_message,
            &dummy_signature,
            Network::Bitcoin,
        );

        // then
        let err = result.expect_err("message above MAX_MESSAGE_BYTES must be rejected");
        assert_eq!(err.code, error_codes::INVALID_SIGNATURE.code);
    }

    /// Given: a base64 signature string that exceeds MAX_SIGNATURE_BASE64_LEN by 1 byte
    /// When: the verifier runs
    /// Then: the call is rejected at the boundary before base64 decode or
    ///       consensus decode runs
    #[test]
    fn verify_rejects_signature_above_base64_size_cap() {
        // given
        let address = "bc1q9vza2e8x573nczrlzms0wvx3gsqjx7vavgkx0l";
        let oversized_signature: String = std::iter::repeat('A')
            .take(MAX_SIGNATURE_BASE64_LEN + 1)
            .collect();

        // when
        let result =
            verify_btc_signature_on_network(address, "msg", &oversized_signature, Network::Bitcoin);

        // then
        let err = result.expect_err("signature above MAX_SIGNATURE_BASE64_LEN must be rejected");
        assert_eq!(err.code, error_codes::INVALID_SIGNATURE.code);
    }

    /// Given: a message exactly at the MAX_MESSAGE_BYTES cap (boundary inclusive)
    /// When: the verifier runs with a legitimate signature for that message
    /// Then: the signature verifies — the cap is inclusive and leaves headroom
    ///       for realistic canonical challenges plus future action fields
    #[test]
    fn verify_accepts_message_exactly_at_size_cap() {
        // given
        let secret = [29u8; 32];
        let message: String = std::iter::repeat('a').take(MAX_MESSAGE_BYTES).collect();
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
            "message exactly at MAX_MESSAGE_BYTES should still verify: {:?}",
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

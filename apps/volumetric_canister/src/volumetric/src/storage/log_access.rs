use super::state::LOG_ACCESS_TOKEN_HASH;
use super::Cbor;

pub fn get_log_access_token_hash() -> Option<String> {
    LOG_ACCESS_TOKEN_HASH.with_borrow(|cell| cell.get().0.clone())
}

pub fn set_log_access_token_hash(token_sha256_hex: String) {
    LOG_ACCESS_TOKEN_HASH.with_borrow_mut(|cell| {
        let _ = cell.set(Cbor(Some(token_sha256_hex)));
    });
}

pub fn clear_log_access_token_hash() {
    LOG_ACCESS_TOKEN_HASH.with_borrow_mut(|cell| {
        let _ = cell.set(Cbor(None));
    });
}

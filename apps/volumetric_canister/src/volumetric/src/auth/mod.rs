pub mod account;
pub mod challenge;
pub mod signature;
pub mod types;

pub use account::{derive_principal, derive_subaccount};
pub use challenge::{build_challenge_context, ensure_challenge_fresh};
pub use signature::verify_btc_signature;
pub use types::{
    build_challenge_message, AuthenticatedPayload, SignableAction, WalletKey, WalletProof,
};

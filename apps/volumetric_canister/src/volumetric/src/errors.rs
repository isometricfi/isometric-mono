use candid::CandidType;
use serde::{Deserialize, Serialize};
use thiserror::Error;

#[derive(Debug, CandidType, Deserialize, Serialize, Error, Clone)]
pub enum VolumetricError {
    #[error("Configuration error: {0}")]
    ConfigError(String),

    #[error("Caller {caller} is not authorized as a controller")]
    UnauthorizedController { caller: String },

    #[error("Caller {caller} is not authorized as whitelisted")]
    UnauthorizedWhitelisted { caller: String },

    #[error("Signature verification failed: {0}")]
    InvalidSignature(String),

    #[error("Profile already registered for this wallet")]
    ProfileAlreadyRegistered,

    #[error("Profile not found")]
    ProfileNotFound,

    #[error("{0}")]
    Internal(String),
}

impl From<String> for VolumetricError {
    fn from(value: String) -> Self {
        VolumetricError::Internal(value)
    }
}

impl From<&'static str> for VolumetricError {
    fn from(value: &'static str) -> Self {
        VolumetricError::Internal(value.into())
    }
}

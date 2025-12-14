use candid::CandidType;
use serde::{Deserialize, Serialize};
use std::fmt;

/// Error code ranges:
/// - 1xxx: Auth/authorization errors
/// - 2xxx: Profile/account errors
/// - 3xxx: Inter-canister call errors
/// - 4xxx: Config errors
/// - 9xxx: Internal/generic errors
pub mod error_codes {
    pub struct ErrorDef {
        pub code: u32,
        pub name: &'static str,
        pub message: &'static str,
    }

    // 1xxx: Auth/authorization errors
    pub const UNAUTHORIZED_CONTROLLER: ErrorDef = ErrorDef {
        code: 1001,
        name: "UNAUTHORIZED_CONTROLLER",
        message: "Caller is not authorized as a controller",
    };
    pub const UNAUTHORIZED_WHITELISTED: ErrorDef = ErrorDef {
        code: 1002,
        name: "UNAUTHORIZED_WHITELISTED",
        message: "Caller is not authorized as whitelisted",
    };
    pub const INVALID_SIGNATURE: ErrorDef = ErrorDef {
        code: 1003,
        name: "INVALID_SIGNATURE",
        message: "Signature verification failed",
    };

    // 2xxx: Profile/account errors
    pub const PROFILE_NOT_FOUND: ErrorDef = ErrorDef {
        code: 2001,
        name: "PROFILE_NOT_FOUND",
        message: "Profile not found",
    };
    pub const PROFILE_ALREADY_REGISTERED: ErrorDef = ErrorDef {
        code: 2002,
        name: "PROFILE_ALREADY_REGISTERED",
        message: "Profile already registered for this wallet",
    };

    // 3xxx: Inter-canister call errors
    pub const INTER_CANISTER_CALL_FAILED: ErrorDef = ErrorDef {
        code: 3001,
        name: "INTER_CANISTER_CALL_FAILED",
        message: "Inter-canister call failed",
    };

    // 4xxx: Config errors
    pub const CONFIG_ERROR: ErrorDef = ErrorDef {
        code: 4001,
        name: "CONFIG_ERROR",
        message: "Configuration error",
    };

    // 9xxx: Internal/generic errors
    pub const INTERNAL_ERROR: ErrorDef = ErrorDef {
        code: 9001,
        name: "INTERNAL_ERROR",
        message: "Internal error",
    };
}

#[derive(Debug, CandidType, Deserialize, Serialize, Clone)]
pub struct ErrorDetails {
    pub caller: Option<String>,
}

#[derive(Debug, CandidType, Deserialize, Serialize, Clone)]
pub struct VolumetricError {
    pub code: u32,
    pub name: String,
    pub message: String,
    pub details: Option<ErrorDetails>,
}

impl VolumetricError {
    fn from_def(def: &error_codes::ErrorDef) -> Self {
        Self {
            code: def.code,
            name: def.name.to_string(),
            message: def.message.to_string(),
            details: None,
        }
    }

    fn from_def_with_reason(def: &error_codes::ErrorDef, reason: &str) -> Self {
        Self {
            code: def.code,
            name: def.name.to_string(),
            message: format!("{}: {}", def.message, reason),
            details: None,
        }
    }

    fn from_def_with_caller(def: &error_codes::ErrorDef, caller: &str) -> Self {
        Self {
            code: def.code,
            name: def.name.to_string(),
            message: format!("{}: {}", def.message, caller),
            details: Some(ErrorDetails {
                caller: Some(caller.to_string()),
            }),
        }
    }

    pub fn unauthorized_controller(caller: &str) -> Self {
        Self::from_def_with_caller(&error_codes::UNAUTHORIZED_CONTROLLER, caller)
    }

    pub fn unauthorized_whitelisted(caller: &str) -> Self {
        Self::from_def_with_caller(&error_codes::UNAUTHORIZED_WHITELISTED, caller)
    }

    pub fn invalid_signature(reason: &str) -> Self {
        Self::from_def_with_reason(&error_codes::INVALID_SIGNATURE, reason)
    }

    pub fn profile_not_found() -> Self {
        Self::from_def(&error_codes::PROFILE_NOT_FOUND)
    }

    pub fn profile_already_registered() -> Self {
        Self::from_def(&error_codes::PROFILE_ALREADY_REGISTERED)
    }

    pub fn inter_canister_call_failed(reason: &str) -> Self {
        Self::from_def_with_reason(&error_codes::INTER_CANISTER_CALL_FAILED, reason)
    }

    pub fn config_error(reason: &str) -> Self {
        Self::from_def_with_reason(&error_codes::CONFIG_ERROR, reason)
    }

    pub fn internal(reason: &str) -> Self {
        Self::from_def_with_reason(&error_codes::INTERNAL_ERROR, reason)
    }
}

impl fmt::Display for VolumetricError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "[{}] {}: {}", self.code, self.name, self.message)
    }
}

impl std::error::Error for VolumetricError {}

impl From<String> for VolumetricError {
    fn from(value: String) -> Self {
        VolumetricError::internal(&value)
    }
}

impl From<&'static str> for VolumetricError {
    fn from(value: &'static str) -> Self {
        VolumetricError::internal(value)
    }
}

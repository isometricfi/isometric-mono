use candid::CandidType;
use serde::{Deserialize, Serialize};
use std::fmt;

/// Error code ranges:
/// - 1xxx: Auth/authorization errors
/// - 2xxx: Profile/account errors
/// - 3xxx: Inter-canister call errors
/// - 4xxx: Config errors
/// - 5xxx: Options errors
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

    // 5xxx: Options errors
    pub const INSUFFICIENT_BALANCE: ErrorDef = ErrorDef {
        code: 5001,
        name: "INSUFFICIENT_BALANCE",
        message: "Insufficient available balance",
    };
    pub const OFFER_NOT_FOUND: ErrorDef = ErrorDef {
        code: 5002,
        name: "OFFER_NOT_FOUND",
        message: "Offer not found",
    };
    pub const OFFER_EXPIRED: ErrorDef = ErrorDef {
        code: 5003,
        name: "OFFER_EXPIRED",
        message: "Offer has expired",
    };
    pub const OFFER_CANCELLED: ErrorDef = ErrorDef {
        code: 5004,
        name: "OFFER_CANCELLED",
        message: "Offer has been cancelled",
    };
    pub const OFFER_FILLED: ErrorDef = ErrorDef {
        code: 5005,
        name: "OFFER_FILLED",
        message: "Offer has been fully filled",
    };
    pub const QUANTITY_BELOW_MINIMUM: ErrorDef = ErrorDef {
        code: 5006,
        name: "QUANTITY_BELOW_MINIMUM",
        message: "Quantity is below minimum",
    };
    pub const QUANTITY_EXCEEDS_AVAILABLE: ErrorDef = ErrorDef {
        code: 5007,
        name: "QUANTITY_EXCEEDS_AVAILABLE",
        message: "Quantity exceeds available in offer",
    };
    pub const NOT_OFFER_OWNER: ErrorDef = ErrorDef {
        code: 5008,
        name: "NOT_OFFER_OWNER",
        message: "Caller is not the offer owner",
    };
    pub const OPTION_NOT_FOUND: ErrorDef = ErrorDef {
        code: 5009,
        name: "OPTION_NOT_FOUND",
        message: "Active option not found",
    };
    pub const OPTION_NOT_EXPIRED: ErrorDef = ErrorDef {
        code: 5010,
        name: "OPTION_NOT_EXPIRED",
        message: "Option has not expired yet",
    };
    pub const OPTION_ALREADY_SETTLED: ErrorDef = ErrorDef {
        code: 5011,
        name: "OPTION_ALREADY_SETTLED",
        message: "Option has already been settled",
    };
    pub const CANNOT_ACCEPT_OWN_OFFER: ErrorDef = ErrorDef {
        code: 5012,
        name: "CANNOT_ACCEPT_OWN_OFFER",
        message: "Cannot accept your own offer",
    };
    pub const OFFER_PROCESSING: ErrorDef = ErrorDef {
        code: 5013,
        name: "OFFER_PROCESSING",
        message: "Offer is currently being processed by another transaction",
    };
    pub const OPTION_SETTLING: ErrorDef = ErrorDef {
        code: 5014,
        name: "OPTION_SETTLING",
        message: "Option is currently being settled by another transaction",
    };
    pub const PARTIAL_FILLING_DISABLED: ErrorDef = ErrorDef {
        code: 5015,
        name: "PARTIAL_FILLING_DISABLED",
        message: "Partial filling is not enabled",
    };
    pub const STITCHING_DISABLED: ErrorDef = ErrorDef {
        code: 5016,
        name: "STITCHING_DISABLED",
        message: "Stitching multiple offers is not enabled",
    };
    pub const QUANTITY_ABOVE_MAXIMUM: ErrorDef = ErrorDef {
        code: 5017,
        name: "QUANTITY_ABOVE_MAXIMUM",
        message: "Quantity exceeds maximum allowed",
    };
    pub const STRIKE_BELOW_MINIMUM: ErrorDef = ErrorDef {
        code: 5018,
        name: "STRIKE_BELOW_MINIMUM",
        message: "Strike basis points below minimum",
    };
    pub const STRIKE_ABOVE_MAXIMUM: ErrorDef = ErrorDef {
        code: 5019,
        name: "STRIKE_ABOVE_MAXIMUM",
        message: "Strike basis points exceeds maximum",
    };
    pub const PREMIUM_BELOW_MINIMUM: ErrorDef = ErrorDef {
        code: 5020,
        name: "PREMIUM_BELOW_MINIMUM",
        message: "Premium basis points below minimum",
    };
    pub const PREMIUM_ABOVE_MAXIMUM: ErrorDef = ErrorDef {
        code: 5021,
        name: "PREMIUM_ABOVE_MAXIMUM",
        message: "Premium basis points exceeds maximum",
    };
    pub const DURATION_BELOW_MINIMUM: ErrorDef = ErrorDef {
        code: 5022,
        name: "DURATION_BELOW_MINIMUM",
        message: "Option duration below minimum",
    };
    pub const DURATION_ABOVE_MAXIMUM: ErrorDef = ErrorDef {
        code: 5023,
        name: "DURATION_ABOVE_MAXIMUM",
        message: "Option duration exceeds maximum",
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

    pub fn insufficient_balance(available: u64, required: u64) -> Self {
        Self::from_def_with_reason(
            &error_codes::INSUFFICIENT_BALANCE,
            &format!("available: {}, required: {}", available, required),
        )
    }

    pub fn offer_not_found(offer_id: u64) -> Self {
        Self::from_def_with_reason(&error_codes::OFFER_NOT_FOUND, &format!("id: {}", offer_id))
    }

    pub fn offer_expired() -> Self {
        Self::from_def(&error_codes::OFFER_EXPIRED)
    }

    pub fn offer_cancelled() -> Self {
        Self::from_def(&error_codes::OFFER_CANCELLED)
    }

    pub fn offer_filled() -> Self {
        Self::from_def(&error_codes::OFFER_FILLED)
    }

    pub fn quantity_below_minimum(quantity: u64, minimum: u64) -> Self {
        Self::from_def_with_reason(
            &error_codes::QUANTITY_BELOW_MINIMUM,
            &format!("got: {}, minimum: {}", quantity, minimum),
        )
    }

    pub fn quantity_exceeds_available(requested: u64, available: u64) -> Self {
        Self::from_def_with_reason(
            &error_codes::QUANTITY_EXCEEDS_AVAILABLE,
            &format!("requested: {}, available: {}", requested, available),
        )
    }

    pub fn not_offer_owner() -> Self {
        Self::from_def(&error_codes::NOT_OFFER_OWNER)
    }

    pub fn option_not_found(option_id: u64) -> Self {
        Self::from_def_with_reason(
            &error_codes::OPTION_NOT_FOUND,
            &format!("id: {}", option_id),
        )
    }

    pub fn option_not_expired() -> Self {
        Self::from_def(&error_codes::OPTION_NOT_EXPIRED)
    }

    pub fn option_already_settled() -> Self {
        Self::from_def(&error_codes::OPTION_ALREADY_SETTLED)
    }

    pub fn cannot_accept_own_offer() -> Self {
        Self::from_def(&error_codes::CANNOT_ACCEPT_OWN_OFFER)
    }

    pub fn offer_processing() -> Self {
        Self::from_def(&error_codes::OFFER_PROCESSING)
    }

    pub fn option_settling() -> Self {
        Self::from_def(&error_codes::OPTION_SETTLING)
    }

    pub fn partial_filling_disabled() -> Self {
        Self::from_def(&error_codes::PARTIAL_FILLING_DISABLED)
    }

    pub fn stitching_disabled() -> Self {
        Self::from_def(&error_codes::STITCHING_DISABLED)
    }

    pub fn quantity_above_maximum(quantity: u64, maximum: u64) -> Self {
        Self::from_def_with_reason(
            &error_codes::QUANTITY_ABOVE_MAXIMUM,
            &format!("got: {}, maximum: {}", quantity, maximum),
        )
    }

    pub fn strike_below_minimum(value: u16, minimum: u16) -> Self {
        Self::from_def_with_reason(
            &error_codes::STRIKE_BELOW_MINIMUM,
            &format!("got: {}, minimum: {}", value, minimum),
        )
    }

    pub fn strike_above_maximum(value: u16, maximum: u16) -> Self {
        Self::from_def_with_reason(
            &error_codes::STRIKE_ABOVE_MAXIMUM,
            &format!("got: {}, maximum: {}", value, maximum),
        )
    }

    pub fn premium_below_minimum(value: u16, minimum: u16) -> Self {
        Self::from_def_with_reason(
            &error_codes::PREMIUM_BELOW_MINIMUM,
            &format!("got: {}, minimum: {}", value, minimum),
        )
    }

    pub fn premium_above_maximum(value: u16, maximum: u16) -> Self {
        Self::from_def_with_reason(
            &error_codes::PREMIUM_ABOVE_MAXIMUM,
            &format!("got: {}, maximum: {}", value, maximum),
        )
    }

    pub fn duration_below_minimum(value: u64, minimum: u64) -> Self {
        Self::from_def_with_reason(
            &error_codes::DURATION_BELOW_MINIMUM,
            &format!("got: {} seconds, minimum: {} seconds", value, minimum),
        )
    }

    pub fn duration_above_maximum(value: u64, maximum: u64) -> Self {
        Self::from_def_with_reason(
            &error_codes::DURATION_ABOVE_MAXIMUM,
            &format!("got: {} seconds, maximum: {} seconds", value, maximum),
        )
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

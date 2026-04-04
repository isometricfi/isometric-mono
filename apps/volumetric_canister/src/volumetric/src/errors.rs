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
    #[derive(Clone, Copy, Debug)]
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
    pub const INVALID_WALLET_ADDRESS: ErrorDef = ErrorDef {
        code: 1004,
        name: "INVALID_WALLET_ADDRESS",
        message: "Invalid wallet address",
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
    pub const ACCEPT_IN_PROGRESS: ErrorDef = ErrorDef {
        code: 5024,
        name: "ACCEPT_IN_PROGRESS",
        message: "An accept operation is already in progress for this user",
    };
    pub const WITHDRAWAL_IN_PROGRESS: ErrorDef = ErrorDef {
        code: 5025,
        name: "WITHDRAWAL_IN_PROGRESS",
        message: "A withdrawal is already in progress for this user",
    };
    pub const OFFER_LIMIT_EXCEEDED: ErrorDef = ErrorDef {
        code: 5026,
        name: "OFFER_LIMIT_EXCEEDED",
        message: "Maximum offers per term exceeded",
    };
    pub const INVALID_OFFER_STATE: ErrorDef = ErrorDef {
        code: 5027,
        name: "INVALID_OFFER_STATE",
        message: "Invalid offer state",
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
    pub fn from_def(
        def: error_codes::ErrorDef,
        message_context: Option<&str>,
        caller: Option<&str>,
    ) -> Self {
        let mut message = def.message.to_string();

        if let Some(message_context) = message_context {
            message.push_str(": ");
            message.push_str(message_context);
        }

        if let Some(caller) = caller {
            message.push_str(": ");
            message.push_str(caller);
        }

        Self {
            code: def.code,
            name: def.name.to_string(),
            message,
            details: caller.map(|caller| ErrorDetails {
                caller: Some(caller.to_string()),
            }),
        }
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
        VolumetricError::from_def(error_codes::INTERNAL_ERROR, Some(&value), None)
    }
}

impl From<&'static str> for VolumetricError {
    fn from(value: &'static str) -> Self {
        VolumetricError::from_def(error_codes::INTERNAL_ERROR, Some(value), None)
    }
}

#[cfg(test)]
mod tests {
    use super::{error_codes, VolumetricError};

    /// Given: an authorization error with the caller principal
    /// When: building the API error payload with caller details
    /// Then: the payload preserves code, message, and caller details
    #[test]
    fn test_with_caller_preserves_caller_details() {
        // given
        let caller = "aaaaa-aa";

        // when
        let error =
            VolumetricError::from_def(error_codes::UNAUTHORIZED_CONTROLLER, None, Some(caller));

        // then
        assert_eq!(error.code, error_codes::UNAUTHORIZED_CONTROLLER.code);
        assert_eq!(error.name, error_codes::UNAUTHORIZED_CONTROLLER.name);
        assert_eq!(
            error.message,
            "Caller is not authorized as a controller: aaaaa-aa"
        );
        assert_eq!(error.details.unwrap().caller.as_deref(), Some(caller));
    }

    /// Given: an invalid-offer-state error with a specific reason
    /// When: building it with the generic reason helper
    /// Then: the payload keeps the existing message format
    #[test]
    fn test_with_reason_preserves_reason_format() {
        // given
        let reason = "cannot cancel offer with status: Processing";

        // when
        let error = VolumetricError::from_def(error_codes::INVALID_OFFER_STATE, Some(reason), None);

        // then
        assert_eq!(error.code, error_codes::INVALID_OFFER_STATE.code);
        assert_eq!(
            error.message,
            "Invalid offer state: cannot cancel offer with status: Processing"
        );
        assert!(error.details.is_none());
    }

    /// Given: a generic string failure
    /// When: converting it into VolumetricError
    /// Then: it becomes the internal error payload
    #[test]
    fn test_string_conversion_maps_to_internal_error() {
        // given
        let reason = String::from("unexpected failure");

        // when
        let error = VolumetricError::from(reason);

        // then
        assert_eq!(error.code, error_codes::INTERNAL_ERROR.code);
        assert_eq!(error.message, "Internal error: unexpected failure");
    }

    /// Given: an error payload with both message context and caller
    /// When: building it from a definition
    /// Then: the message includes both values and the caller remains structured
    #[test]
    fn test_from_def_supports_context_and_caller() {
        // given
        let context = "canister rejected request";
        let caller = "aaaaa-aa";

        // when
        let error = VolumetricError::from_def(
            error_codes::UNAUTHORIZED_CONTROLLER,
            Some(context),
            Some(caller),
        );

        // then
        assert_eq!(
            error.message,
            "Caller is not authorized as a controller: canister rejected request: aaaaa-aa"
        );
        assert_eq!(error.details.unwrap().caller.as_deref(), Some(caller));
    }
}

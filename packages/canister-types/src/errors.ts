import type { VolumetricError } from "./generated/volumetric_dev.did";

/**
 * Error codes - must match apps/volumetric_canister/src/volumetric/src/errors.rs
 *
 * Ranges:
 * - 1xxx: Auth/authorization errors
 * - 2xxx: Profile/account errors
 * - 3xxx: Inter-canister call errors
 * - 4xxx: Config errors
 * - 5xxx: Options/trading errors
 * - 9xxx: Internal/generic errors
 */
export const ErrorCode = {
  // 1xxx: Auth/authorization errors
  UNAUTHORIZED_CONTROLLER: 1001,
  UNAUTHORIZED_WHITELISTED: 1002,
  INVALID_SIGNATURE: 1003,

  // 2xxx: Profile/account errors
  PROFILE_NOT_FOUND: 2001,
  PROFILE_ALREADY_REGISTERED: 2002,

  // 3xxx: Inter-canister call errors
  INTER_CANISTER_CALL_FAILED: 3001,

  // 4xxx: Config errors
  CONFIG_ERROR: 4001,

  // 5xxx: Options/trading errors
  INSUFFICIENT_BALANCE: 5001,
  OFFER_NOT_FOUND: 5002,
  OFFER_EXPIRED: 5003,
  OFFER_CANCELLED: 5004,
  OFFER_FILLED: 5005,
  QUANTITY_BELOW_MINIMUM: 5006,
  QUANTITY_EXCEEDS_AVAILABLE: 5007,
  NOT_OFFER_OWNER: 5008,
  OPTION_NOT_FOUND: 5009,
  OPTION_NOT_EXPIRED: 5010,
  OPTION_ALREADY_SETTLED: 5011,
  CANNOT_ACCEPT_OWN_OFFER: 5012,
  OFFER_PROCESSING: 5013,
  OPTION_SETTLING: 5014,
  PARTIAL_FILLING_DISABLED: 5015,
  STITCHING_DISABLED: 5016,

  // 9xxx: Internal/generic errors
  INTERNAL_ERROR: 9001,
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

const errorMessages: Record<ErrorCode, string> = {
  [ErrorCode.UNAUTHORIZED_CONTROLLER]: "You are not authorized to perform this action",
  [ErrorCode.UNAUTHORIZED_WHITELISTED]: "You are not authorized to perform this action",
  [ErrorCode.INVALID_SIGNATURE]: "Signature verification failed",
  [ErrorCode.PROFILE_NOT_FOUND]: "Profile not found",
  [ErrorCode.PROFILE_ALREADY_REGISTERED]: "Account already exists",
  [ErrorCode.INTER_CANISTER_CALL_FAILED]: "Service temporarily unavailable",
  [ErrorCode.CONFIG_ERROR]: "Service configuration error",
  [ErrorCode.INSUFFICIENT_BALANCE]: "Insufficient balance",
  [ErrorCode.OFFER_NOT_FOUND]: "Offer not found",
  [ErrorCode.OFFER_EXPIRED]: "This offer has expired",
  [ErrorCode.OFFER_CANCELLED]: "This offer has been cancelled",
  [ErrorCode.OFFER_FILLED]: "This offer has been fully filled",
  [ErrorCode.QUANTITY_BELOW_MINIMUM]: "Quantity is below minimum",
  [ErrorCode.QUANTITY_EXCEEDS_AVAILABLE]: "Quantity exceeds available amount",
  [ErrorCode.NOT_OFFER_OWNER]: "You are not the owner of this offer",
  [ErrorCode.OPTION_NOT_FOUND]: "Option not found",
  [ErrorCode.OPTION_NOT_EXPIRED]: "Option has not expired yet",
  [ErrorCode.OPTION_ALREADY_SETTLED]: "Option has already been settled",
  [ErrorCode.CANNOT_ACCEPT_OWN_OFFER]: "You cannot accept your own offer",
  [ErrorCode.OFFER_PROCESSING]: "This offer is being processed, please try again",
  [ErrorCode.OPTION_SETTLING]: "This option is being settled, please wait",
  [ErrorCode.PARTIAL_FILLING_DISABLED]: "Partial filling is not currently enabled",
  [ErrorCode.STITCHING_DISABLED]: "Accepting multiple offers at once is not currently enabled",
  [ErrorCode.INTERNAL_ERROR]: "An unexpected error occurred",
};

export function getErrorMessage(err: CanisterError): string {
  const baseMessage = errorMessages[err.code as ErrorCode];
  if (!baseMessage) {
    return err.message;
  }
  if (err.message && err.message !== baseMessage) {
    return `${baseMessage}: ${err.message}`;
  }
  return baseMessage;
}

export class CanisterError extends Error {
  code: number;
  errorName: string;
  details: { caller?: string } | null;

  constructor(err: VolumetricError) {
    super(err.message);
    this.code = err.code;
    this.errorName = err.name;
    const details = err.details[0];
    this.details = details ? { caller: details.caller[0] } : null;
    this.name = "CanisterError";
  }

  is(code: ErrorCode): boolean {
    return this.code === code;
  }
}

export function unwrapResult<T>(result: { Ok: T } | { Err: VolumetricError }): T {
  if ("Err" in result) {
    throw new CanisterError(result.Err);
  }
  return result.Ok;
}

import type { VolumetricError } from "./generated/volumetric_dev.did";

/**
 * Error codes - must match apps/volumetric_canister/src/volumetric/src/errors.rs
 *
 * Ranges:
 * - 1xxx: Auth/authorization errors
 * - 2xxx: Profile/account errors
 * - 3xxx: Inter-canister call errors
 * - 4xxx: Config errors
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
  [ErrorCode.INTERNAL_ERROR]: "An unexpected error occurred",
};

export function getErrorMessage(err: CanisterError): string {
  return errorMessages[err.code as ErrorCode] ?? err.message;
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

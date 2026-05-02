import { CanisterError, getErrorMessage } from "@volumetric/canister-types";

const UNSAFE_PATTERNS = [
  /Call failed:/i,
  /\bCanister:\s*[a-z0-9-]+/i,
  /ic0\.trap/i,
  /Result::unwrap/i,
  /Panicked at/i,
  /Subtyping error/i,
  /TypeInner/i,
  /Fail to decode/i,
  /CanisterError "/i,
  /internetcomputer\.org/i,
  /agent-js/i,
  /Reject(?:ion)? code/i,
];

function isUnsafeMessage(message: string): boolean {
  return UNSAFE_PATTERNS.some((pattern) => pattern.test(message));
}

/**
 * Returns a message safe to show to end users, or null when the underlying
 * error is internal noise (ICP agent traps, decoding errors, etc.) that
 * callers should replace with a generic fallback.
 */
export function toSafeErrorMessage(err: unknown): string | null {
  if (err instanceof CanisterError) {
    const message = getErrorMessage(err);
    return message && !isUnsafeMessage(message) ? message : null;
  }
  if (err instanceof Error) {
    const message = err.message?.trim();
    if (!message) return null;
    return isUnsafeMessage(message) ? null : message;
  }
  if (typeof err === "string") {
    const trimmed = err.trim();
    if (!trimmed) return null;
    return isUnsafeMessage(trimmed) ? null : trimmed;
  }
  return null;
}

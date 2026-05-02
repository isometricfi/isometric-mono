import { CanisterError, getErrorMessage } from "@volumetric/canister-types";

/**
 * Returns a user-safe message for known canister errors (raised directly,
 * or surfaced through the trpc errorFormatter which stamps
 * `data.canisterErrorCode`). Returns null for anything else so callers
 * can fall back to a generic "something went wrong" message.
 */
export function getNiceErrorMessage(err: unknown): string | null {
  if (err instanceof CanisterError) return getErrorMessage(err);
  if (err && typeof err === "object" && "data" in err) {
    const data = (err as { data?: unknown }).data;
    if (
      data &&
      typeof data === "object" &&
      "canisterErrorCode" in data &&
      err instanceof Error &&
      err.message
    ) {
      return err.message;
    }
  }
  return null;
}

export const INVITE_CODE_STORAGE_KEY = "volumetric.inviteCode";
export const INVITE_CODE_PATTERN = /^[A-Z0-9]{6}$/;

export function normalizeInviteCode(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const normalizedValue = value.trim().toUpperCase();
  if (!INVITE_CODE_PATTERN.test(normalizedValue)) {
    return null;
  }

  return normalizedValue;
}

export function readInviteCodeFromSession(): string | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }

  return normalizeInviteCode(window.sessionStorage.getItem(INVITE_CODE_STORAGE_KEY)) ?? undefined;
}

export function setInviteCodeInSession(value: string): void {
  if (typeof window === "undefined") {
    return;
  }

  const normalizedValue = normalizeInviteCode(value);
  if (!normalizedValue) {
    return;
  }

  window.sessionStorage.setItem(INVITE_CODE_STORAGE_KEY, normalizedValue);
}

export function clearInviteCodeFromSession(): void {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.removeItem(INVITE_CODE_STORAGE_KEY);
}

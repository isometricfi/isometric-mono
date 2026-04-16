import type { _SERVICE } from "@volumetric/canister-types";

export async function validateInviteCode(
  canister: _SERVICE,
  inviteCode: string | undefined,
  address: string,
): Promise<void> {
  if (!inviteCode) {
    return;
  }

  const isValid = await canister.validate_invite_code(inviteCode, address);
  if (!isValid) {
    throw new Error("Invalid invite code");
  }
}

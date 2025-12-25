import type { ProfileInfo } from "@volumetric/canister-types";
import type { CreateAccountResponse } from "./types";

export const mapCreateAccount = (profile: ProfileInfo): CreateAccountResponse => ({
  principal: profile.principal.toText(),
  subaccount: Array.from(profile.subaccount),
  address: profile.address,
  username: profile.username[0] ?? null,
});

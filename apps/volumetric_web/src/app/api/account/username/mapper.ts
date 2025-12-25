import type { ProfileInfo } from "@volumetric/canister-types";
import type { UpdateUsernameResponse } from "./types";

export const mapUpdateUsername = (profile: ProfileInfo): UpdateUsernameResponse => ({
  principal: profile.principal.toText(),
  subaccount: Array.from(profile.subaccount),
  address: profile.address,
  username: profile.username[0] ?? null,
});

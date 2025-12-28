import type { ProfileInfo } from "@volumetric/canister-types";
import type { Output } from "./schema";

export function mapResult(profile: ProfileInfo): Output {
  return {
    principal: profile.principal.toText(),
    subaccount: Array.from(profile.subaccount),
    address: profile.address,
    username: profile.username[0] ?? null,
  };
}

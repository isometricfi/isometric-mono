import { type ActorSubclass, type Identity } from "@icp-sdk/core/agent";
import { type _SERVICE, createActor } from "@volumetric/canister-types";

export function createVolumetricClient({
  canisterId,
  host,
  identity,
}: {
  canisterId: string;
  host: string;
  identity?: Identity;
}): ActorSubclass<_SERVICE> {
  return createActor(canisterId, { agentOptions: { host, identity } });
}

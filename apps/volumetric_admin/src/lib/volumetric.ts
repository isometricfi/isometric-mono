import { type ActorSubclass, HttpAgent, type Identity } from "@dfinity/agent";
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
  const agent = new HttpAgent({ host, identity });
  return createActor(canisterId, { agent });
}

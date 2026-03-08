import { Actor, HttpAgent } from "@dfinity/agent";
import { type _SERVICE, idlFactory } from "@volumetric/canister-types";

let cachedActor: _SERVICE | null = null;

export async function getCanisterActor(canisterId: string, icHost: string): Promise<_SERVICE> {
  if (cachedActor) {
    return cachedActor;
  }

  const agent = await HttpAgent.create({
    host: icHost,
    fetch: (input, init) => fetch(input, init),
  });

  if (!icHost.includes("ic0.app") && !icHost.includes("icp0.io")) {
    await agent.fetchRootKey();
  }

  cachedActor = Actor.createActor<_SERVICE>(idlFactory, {
    agent,
    canisterId,
  });

  return cachedActor;
}

export async function getCreateOfferMessage(
  actor: _SERVICE,
  address: string,
  quantity: bigint,
  strikeBasisPoints: number,
  premiumBasisPoints: number,
): Promise<string> {
  return actor.get_create_offer_message(address, quantity, strikeBasisPoints, premiumBasisPoints);
}

export async function getAcceptOffersMessage(
  actor: _SERVICE,
  address: string,
  items: Array<{ offer_id: bigint; quantity: bigint }>,
): Promise<string> {
  return actor.get_accept_offers_message(address, items);
}

export async function getCreateAccountMessage(actor: _SERVICE, address: string): Promise<string> {
  return actor.get_message_to_sign(address);
}

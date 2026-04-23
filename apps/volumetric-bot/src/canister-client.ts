import { Actor, HttpAgent } from "@dfinity/agent";
import { type _SERVICE, idlFactory, unwrapResult } from "@volumetric/canister-types";

let cachedActor: _SERVICE | null = null;

const SIGNING_WINDOW_SECONDS = 300;

/// The bot runs on a cron schedule, so a 5-minute window is comfortable and
/// still within the canister's MAX_CHALLENGE_LIFETIME_SECONDS.
export function computeExpiresAtSeconds(): bigint {
  return BigInt(Math.floor(Date.now() / 1000) + SIGNING_WINDOW_SECONDS);
}

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
  optionDurationSeconds: bigint,
  offerValidUntil: bigint,
  expiresAtSeconds: bigint,
): Promise<string> {
  return unwrapResult(
    await actor.get_create_offer_message(
      address,
      quantity,
      strikeBasisPoints,
      premiumBasisPoints,
      optionDurationSeconds,
      offerValidUntil,
      expiresAtSeconds,
    ),
  );
}

export async function getAcceptOffersMessage(
  actor: _SERVICE,
  address: string,
  items: Array<{ offer_id: bigint; quantity: bigint }>,
  expiresAtSeconds: bigint,
): Promise<string> {
  return unwrapResult(await actor.get_accept_offers_message(address, items, expiresAtSeconds));
}

export async function getCreateAccountMessage(
  actor: _SERVICE,
  address: string,
  inviteCode: string | null,
  expiresAtSeconds: bigint,
): Promise<string> {
  return unwrapResult(
    await actor.get_message_to_sign(address, inviteCode ? [inviteCode] : [], expiresAtSeconds),
  );
}

import { Actor, HttpAgent, type Identity } from "@dfinity/agent";
import { Ed25519KeyIdentity } from "@dfinity/identity";
import { type _SERVICE, idlFactory } from "@volumetric/canister-types";

let cachedAgent: HttpAgent | null = null;
let cachedActor: _SERVICE | null = null;

function getIdentity(): Identity {
  const privateKeyHex = process.env.WHITELISTED_PRINCIPAL_PRIVATE_KEY;
  if (!privateKeyHex) {
    throw new Error("WHITELISTED_PRINCIPAL_PRIVATE_KEY environment variable is not set");
  }

  const privateKeyBytes = Uint8Array.from(
    privateKeyHex.match(/.{1,2}/g)!.map((byte) => Number.parseInt(byte, 16)),
  );

  return Ed25519KeyIdentity.fromSecretKey(privateKeyBytes.buffer);
}

async function getAgent(): Promise<HttpAgent> {
  if (cachedAgent) {
    return cachedAgent;
  }

  const identity = getIdentity();
  const host = process.env.IC_HOST || "https://ic0.app";

  cachedAgent = await HttpAgent.create({
    identity,
    host,
  });

  if (process.env.DFX_NETWORK !== "ic") {
    await cachedAgent.fetchRootKey();
  }

  return cachedAgent;
}

export async function getCanisterActor(): Promise<_SERVICE> {
  if (cachedActor) {
    return cachedActor;
  }

  const canisterId = process.env.CANISTER_ID;
  if (!canisterId) {
    throw new Error("CANISTER_ID environment variable is not set");
  }

  const agent = await getAgent();

  cachedActor = Actor.createActor<_SERVICE>(idlFactory, {
    agent,
    canisterId,
  });

  return cachedActor;
}

export async function getIdentityPrincipal(): Promise<string> {
  const identity = getIdentity();
  return identity.getPrincipal().toText();
}

import { Actor, HttpAgent, type Identity } from "@icp-sdk/core/agent";
import { Ed25519KeyIdentity } from "@icp-sdk/core/identity";
import { type _SERVICE, idlFactory } from "@volumetric/canister-types";

let cachedAgent: HttpAgent | null = null;
let cachedActor: _SERVICE | null = null;
const LOCAL_REPLICA_HOSTNAMES = new Set(["localhost", "127.0.0.1", "0.0.0.0", "::1"]);

function isLocalReplicaHost(host: string): boolean {
  try {
    const parsedHost = new URL(host).hostname;
    return LOCAL_REPLICA_HOSTNAMES.has(parsedHost) || parsedHost.endsWith(".localhost");
  } catch {
    return host.includes("localhost") || host.includes("127.0.0.1");
  }
}

function getIdentity(): Identity {
  const privateKeyHex = process.env.WHITELISTED_PRINCIPAL_PRIVATE_KEY;
  if (!privateKeyHex) {
    throw new Error("WHITELISTED_PRINCIPAL_PRIVATE_KEY environment variable is not set");
  }

  const privateKeyBytes = Uint8Array.from(
    privateKeyHex.match(/.{1,2}/g)!.map((byte) => Number.parseInt(byte, 16)),
  );

  return Ed25519KeyIdentity.fromSecretKey(privateKeyBytes);
}

export async function getSharedAgent(): Promise<HttpAgent> {
  return getAgent();
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

  if (isLocalReplicaHost(host)) {
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

import { Actor, HttpAgent } from "@dfinity/agent";

// Imports and re-exports candid interface
import { idlFactory } from "./volumetric_dev.did.js";
export { idlFactory } from "./volumetric_dev.did.js";

/* CANISTER_ID is replaced by webpack based on node environment
 * Note: canister environment variable will be standardized as
 * process.env.CANISTER_ID_<CANISTER_NAME_UPPERCASE>
 * beginning in dfx 0.15.0
 */
export const canisterId =
  process.env.CANISTER_ID_VOLUMETRIC_DEV;

const LOCAL_REPLICA_HOSTNAMES = new Set(["localhost", "127.0.0.1", "0.0.0.0", "::1"]);

const isLocalReplicaHost = (host) => {
  if (!host) {
    return false;
  }

  try {
    const parsedHost = new URL(host).hostname;
    return LOCAL_REPLICA_HOSTNAMES.has(parsedHost) || parsedHost.endsWith(".localhost");
  } catch {
    return host.includes("localhost") || host.includes("127.0.0.1");
  }
};

export const createActor = (canisterId, options = {}) => {
  const agent = options.agent || new HttpAgent({ ...options.agentOptions });

  if (options.agent && options.agentOptions) {
    console.warn(
      "Detected both agent and agentOptions passed to createActor. Ignoring agentOptions and proceeding with the provided agent."
    );
  }

  const host = options.agentOptions?.host;
  if (isLocalReplicaHost(host)) {
    agent.fetchRootKey().catch((err) => {
      console.warn(
        "Unable to fetch root key. Check to ensure that your local replica is running"
      );
      console.error(err);
    });
  }

  // Creates an actor with using the candid interface and the HttpAgent
  return Actor.createActor(idlFactory, {
    agent,
    canisterId,
    ...options.actorOptions,
  });
};

export const volumetric_dev = canisterId ? createActor(canisterId) : undefined;

import { type _SERVICE, createActor } from "@volumetric/canister-types";
import { trpc } from "@/lib/trpc";

export function useCanisterConfig() {
  return trpc.config.getCanisterInfo.useQuery();
}

export function useCanister(): _SERVICE | null {
  const { data: config } = useCanisterConfig();

  if (!config?.canisterId) {
    return null;
  }

  return createActor(config.canisterId, {
    agentOptions: { host: config.icHost },
  });
}

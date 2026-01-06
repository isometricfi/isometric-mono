import { useQuery } from "@tanstack/react-query";
import { type _SERVICE, createActor } from "@volumetric/canister-types";
import { useTRPC } from "@/trpc/react";

export function useConfig() {
  const trpc = useTRPC();
  return useQuery(trpc.config.getConfig.queryOptions());
}

export function useCanister(): _SERVICE | null {
  const { data: config } = useConfig();

  if (!config?.canisterId) {
    return null;
  }

  return createActor(config.canisterId, {
    agentOptions: { host: config.icHost },
  });
}

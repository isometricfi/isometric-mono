import type { _SERVICE } from "@volumetric/canister-types";
import { demoBrowserActor } from "@/lib/demo/demo-canister-browser";

export function useCanister(): _SERVICE {
  return demoBrowserActor as _SERVICE;
}

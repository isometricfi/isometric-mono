import type { _SERVICE } from "@volumetric/canister-types";
import { demoBrowserActor } from "@/lib/demo/demo-canister-browser";

export async function getCanisterActor(): Promise<_SERVICE> {
  return demoBrowserActor;
}

import type { Output } from "./schema";

export function getCanisterConfig(): Output {
  return {
    canisterId: process.env.CANISTER_ID,
    icHost: process.env.IC_HOST || "https://ic0.app",
  };
}

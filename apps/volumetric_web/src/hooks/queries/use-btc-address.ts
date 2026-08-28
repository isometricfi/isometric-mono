"use client";

import { DEMO_USER_ADDRESS } from "@/lib/demo/demo-canister-browser";

export type BtcAddressType = "payment" | "ordinals";

export function useBtcAddress(_preferredType: BtcAddressType = "payment") {
  return DEMO_USER_ADDRESS;
}

export function useBtcAddresses() {
  return {
    payment: DEMO_USER_ADDRESS,
    ordinals: DEMO_USER_ADDRESS,
    primary: DEMO_USER_ADDRESS,
  };
}

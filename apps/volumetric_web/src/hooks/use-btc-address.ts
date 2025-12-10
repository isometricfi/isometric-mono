"use client";

import { useDynamicContext } from "@dynamic-labs/sdk-react-core";
import { isBitcoinWallet } from "@dynamic-labs/bitcoin";

export type BtcAddressType = "payment" | "ordinals";

interface AdditionalAddress {
  type: string;
  address: string;
}

export function useBtcAddress(preferredType: BtcAddressType = "payment") {
  const { primaryWallet } = useDynamicContext();

  if (!primaryWallet || !isBitcoinWallet(primaryWallet)) {
    return null;
  }

  const additionalAddresses = (primaryWallet as unknown as { additionalAddresses?: AdditionalAddress[] }).additionalAddresses;

  if (!additionalAddresses || additionalAddresses.length === 0) {
    return primaryWallet.address;
  }

  const targetAddress = additionalAddresses.find(
    (addr) => addr.type === preferredType
  );

  if (targetAddress) {
    return targetAddress.address;
  }

  return primaryWallet.address;
}

export function useBtcAddresses() {
  const { primaryWallet } = useDynamicContext();

  if (!primaryWallet || !isBitcoinWallet(primaryWallet)) {
    return { payment: null, ordinals: null, primary: null };
  }

  const additionalAddresses = (primaryWallet as unknown as { additionalAddresses?: AdditionalAddress[] }).additionalAddresses;

  const payment = additionalAddresses?.find((addr) => addr.type === "payment")?.address ?? null;
  const ordinals = additionalAddresses?.find((addr) => addr.type === "ordinals")?.address ?? null;

  return {
    payment,
    ordinals,
    primary: primaryWallet.address,
  };
}

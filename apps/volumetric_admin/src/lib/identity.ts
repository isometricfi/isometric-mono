import type { Identity } from "@icp-sdk/core/agent";
import { Ed25519KeyIdentity } from "@icp-sdk/core/identity";

const HEX_BYTE_LENGTH = 2;

export function getWhitelistedIdentity(): Identity {
  const privateKeyHex = import.meta.env.VITE_WHITELISTED_PRINCIPAL_PRIVATE_KEY?.trim();
  if (!privateKeyHex) {
    throw new Error("VITE_WHITELISTED_PRINCIPAL_PRIVATE_KEY environment variable is not set");
  }

  const privateKeyBytes = hexToBytes(privateKeyHex);
  return Ed25519KeyIdentity.fromSecretKey(privateKeyBytes);
}

export function getWhitelistedPrincipalText(): string {
  return getWhitelistedIdentity().getPrincipal().toText();
}

export function hexToBytes(hex: string): Uint8Array {
  const normalizedHex = hex.trim();
  if (normalizedHex.length % HEX_BYTE_LENGTH !== 0) {
    throw new Error("Private key hex must contain an even number of characters");
  }

  const bytes = normalizedHex.match(/.{1,2}/g) ?? [];
  return Uint8Array.from(bytes.map((byte) => Number.parseInt(byte, 16)));
}

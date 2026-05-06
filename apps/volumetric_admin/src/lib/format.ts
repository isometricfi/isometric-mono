import type { Principal } from "@icp-sdk/core/principal";

export function formatSats(amount: bigint | number): string {
  const amountBigInt = typeof amount === "bigint" ? amount : BigInt(amount);
  return `${amountBigInt.toLocaleString()} sats`;
}

export function formatBasisPoints(basisPoints: bigint | number): string {
  const value = Number(basisPoints) / 100;
  return `${value.toLocaleString(undefined, {
    maximumFractionDigits: 2,
  })}%`;
}

const UNIX_EPOCH_MS_PER_SECOND = 1000;

export function formatUnixSecondsUtc(seconds: bigint | number): string {
  const sec = typeof seconds === "bigint" ? Number(seconds) : seconds;
  if (!Number.isFinite(sec) || sec < 0) {
    return "—";
  }
  const date = new Date(sec * UNIX_EPOCH_MS_PER_SECOND);
  return `${date.toLocaleString("en-GB", {
    timeZone: "UTC",
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  })} UTC`;
}

export function formatTimestampNs(timestampNs: bigint | number): string {
  const value = typeof timestampNs === "bigint" ? timestampNs : BigInt(timestampNs);
  if (value === 0n) {
    return "unknown";
  }

  const timestampMs = Number(value / 1_000_000n);
  return new Date(timestampMs).toLocaleString();
}

export function bytesToHex(bytes: Uint8Array | number[]): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function principalText(principal: Principal | string): string {
  return typeof principal === "string" ? principal : principal.toText();
}

export function shortPrincipal(principal: Principal | string): string {
  const text = principalText(principal);
  if (text.length <= 18) {
    return text;
  }
  return `${text.slice(0, 9)}...${text.slice(-7)}`;
}

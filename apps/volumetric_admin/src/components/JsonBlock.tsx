import { LayerCard } from "@cloudflare/kumo";

export function JsonBlock({ value, maxHeight = "420px" }: { value: unknown; maxHeight?: string }) {
  return (
    <LayerCard className="overflow-hidden rounded-none p-0">
      <pre
        className="overflow-auto p-4 text-[12px] leading-relaxed text-kumo-default"
        style={{ maxHeight }}
      >
        {stringifyWithBigInt(value)}
      </pre>
    </LayerCard>
  );
}

export function stringifyWithBigInt(value: unknown, space = 2): string {
  return JSON.stringify(
    value,
    (_key, innerValue) => {
      if (typeof innerValue === "bigint") {
        return innerValue.toString();
      }
      if (innerValue instanceof Uint8Array) {
        return Array.from(innerValue, (byte) => byte.toString(16).padStart(2, "0")).join("");
      }
      if (
        innerValue &&
        typeof innerValue === "object" &&
        "toText" in innerValue &&
        typeof (innerValue as { toText: unknown }).toText === "function"
      ) {
        return (innerValue as { toText: () => string }).toText();
      }
      return innerValue;
    },
    space,
  );
}

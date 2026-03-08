import type { EnvValue } from "./env";

export function parseOtlpHeaders(rawHeaders: EnvValue): Record<string, string> | undefined {
  if (!rawHeaders) {
    return undefined;
  }

  const decodedHeaders = decodeHeaderValue(rawHeaders.trim());

  if (!decodedHeaders.length) {
    return undefined;
  }

  const parsedHeaders = Object.fromEntries(
    decodedHeaders
      .split(",")
      .map((header) => header.trim())
      .filter(Boolean)
      .map((header) => {
        const separatorIndex = header.indexOf("=");

        if (separatorIndex <= 0) {
          return undefined;
        }

        const key = header.slice(0, separatorIndex).trim();
        const value = header.slice(separatorIndex + 1).trim();

        if (!key || !value) {
          return undefined;
        }

        return [key, value] as const;
      })
      .filter((header): header is readonly [string, string] => header !== undefined),
  );

  if (Object.keys(parsedHeaders).length === 0) {
    return undefined;
  }

  return parsedHeaders;
}

function decodeHeaderValue(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

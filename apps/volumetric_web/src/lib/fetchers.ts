import type { ConfigData } from "@/types/config";
import type { OptionsData } from "@/types/options";

function getBaseUrl(): string {
  if (typeof window !== "undefined") {
    return "";
  }
  if (process.env.NEXT_PUBLIC_URL) {
    return process.env.NEXT_PUBLIC_URL;
  }
  return `http://localhost:4200`;
}

export async function fetchConfig(): Promise<ConfigData> {
  const response = await fetch(`${getBaseUrl()}/api/volumetric-config`);
  if (!response.ok) {
    throw new Error("Failed to fetch config");
  }
  return response.json();
}

export async function fetchOptions(): Promise<OptionsData> {
  const response = await fetch(`${getBaseUrl()}/api/options`);
  if (!response.ok) {
    throw new Error("Failed to fetch options");
  }
  return response.json();
}

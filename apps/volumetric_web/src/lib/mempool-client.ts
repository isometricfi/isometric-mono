import { withWebSpan } from "@/lib/telemetry";

export interface MempoolOutput {
  scriptpubkey_address?: string;
  value?: number;
}

export interface MempoolAddressTransaction {
  txid: string;
  status?: {
    confirmed?: boolean;
    block_height?: number;
  };
  vout?: MempoolOutput[];
}

function getMempoolApiBaseUrl(): string {
  const apiBaseUrl = process.env.MEMPOOL_API_URL?.trim();
  if (!apiBaseUrl) {
    throw new Error("MEMPOOL_API_URL environment variable is required");
  }

  return apiBaseUrl.replace(/\/$/, "");
}

async function fetchMempool(path: string): Promise<Response> {
  return withWebSpan("web.backend.mempool.fetch", { path }, async () => {
    const baseUrl = getMempoolApiBaseUrl();
    const response = await fetch(`${baseUrl}${path}`);

    if (!response.ok) {
      throw new Error(`Mempool request failed (${response.status}) for ${path}`);
    }

    return response;
  });
}

export async function getMempoolTipHeight(): Promise<number> {
  return withWebSpan("web.backend.mempool.get_tip_height", {}, async () => {
    const response = await fetchMempool("/blocks/tip/height");
    const body = await response.text();
    const tipHeight = Number.parseInt(body, 10);

    if (!Number.isFinite(tipHeight)) {
      throw new Error("Invalid mempool tip height response");
    }

    return tipHeight;
  });
}

export async function getMempoolAddressTransactions(
  address: string,
): Promise<MempoolAddressTransaction[]> {
  return withWebSpan("web.backend.mempool.get_address_transactions", { address }, async () => {
    const response = await fetchMempool(`/address/${address}/txs`);
    const body = await response.json();
    return Array.isArray(body) ? (body as MempoolAddressTransaction[]) : [];
  });
}

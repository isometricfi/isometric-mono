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

export async function fetchAddressTransactions(
  baseUrl: string,
  address: string,
): Promise<MempoolAddressTransaction[]> {
  const response = await fetch(`${baseUrl}/api/address/${address}/txs`);
  if (!response.ok) {
    throw new Error(`Mempool request failed (${response.status})`);
  }
  const body = await response.json();
  return Array.isArray(body) ? (body as MempoolAddressTransaction[]) : [];
}

export async function fetchTipHeight(baseUrl: string): Promise<number> {
  const response = await fetch(`${baseUrl}/api/blocks/tip/height`);
  if (!response.ok) {
    throw new Error(`Mempool request failed (${response.status})`);
  }
  const body = await response.text();
  const height = Number.parseInt(body, 10);
  if (!Number.isFinite(height)) {
    throw new Error("Invalid mempool tip height response");
  }
  return height;
}

interface MempoolAddressTrackerCallbacks {
  onTransaction: () => void;
  onBlockHeight: (height: number) => void;
}

const MIN_RECONNECT_DELAY_1_SECOND_MS = 1_000;
const MAX_RECONNECT_DELAY_30_SECONDS_MS = 30_000;

export class MempoolAddressTracker {
  private ws: WebSocket | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectDelay = MIN_RECONNECT_DELAY_1_SECOND_MS;
  private stopped = false;

  constructor(
    private baseUrl: string,
    private address: string,
    private callbacks: MempoolAddressTrackerCallbacks,
  ) {}

  connect(): void {
    this.stopped = false;
    this.createConnection();
  }

  disconnect(): void {
    this.stopped = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  private createConnection(): void {
    if (this.stopped) return;

    const url = new URL(this.baseUrl);
    const wsProtocol = url.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${wsProtocol}//${url.host}${url.pathname.replace(/\/$/, "")}/api/v1/ws`;

    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      this.reconnectDelay = MIN_RECONNECT_DELAY_1_SECOND_MS;
      this.ws?.send(JSON.stringify({ "track-address": this.address }));
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data as string);

        if (data["address-transactions"]) {
          this.callbacks.onTransaction();
        }

        if (data.block?.height && typeof data.block.height === "number") {
          this.callbacks.onBlockHeight(data.block.height);
        }
      } catch {}
    };

    this.ws.onclose = () => {
      this.ws = null;
      this.scheduleReconnect();
    };

    this.ws.onerror = () => {
      this.ws?.close();
    };
  }

  private scheduleReconnect(): void {
    if (this.stopped) return;

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.createConnection();
    }, this.reconnectDelay);

    this.reconnectDelay = Math.min(this.reconnectDelay * 2, MAX_RECONNECT_DELAY_30_SECONDS_MS);
  }
}

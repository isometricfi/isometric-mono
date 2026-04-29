export interface StoredBtcCurrentPrice {
  priceUsd: number;
  updatedAtMs: number;
}

export interface StoredBtcHistoryPoint {
  timestampMs: number;
  priceUsd: number;
}

export interface BtcCurrentPriceToSave {
  priceUsd: number;
  source: string;
  updatedAtMs: number;
}

export interface BtcHistoryPointToSave {
  timestampMs: number;
  priceUsd: number;
  source: string;
  updatedAtMs: number;
}

export interface IMarketDataRepository {
  saveCurrentBtcPrice(price: BtcCurrentPriceToSave): Promise<void>;
  saveBtcHistoryPoints(points: BtcHistoryPointToSave[]): Promise<void>;
  getCurrentBtcPrice(): Promise<StoredBtcCurrentPrice | null>;
  getBtcHistoryPointsSince(timestampMs: number): Promise<StoredBtcHistoryPoint[]>;
  getLatestBtcHistoryUpdatedAtMs(): Promise<number | null>;
}

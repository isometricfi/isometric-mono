export interface InsertXrcBtcUsdSnapshotInput {
  fetchedAtMs: number;
  responseJson: string;
}

export interface IXrcSnapshotRepository {
  getLatestSnapshotResponseJson(): Promise<string | null>;
  insertSnapshot(input: InsertXrcBtcUsdSnapshotInput): Promise<void>;
}

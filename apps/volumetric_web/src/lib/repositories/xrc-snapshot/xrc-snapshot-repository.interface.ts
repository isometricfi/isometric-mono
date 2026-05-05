export interface XrcSnapshotToSave {
  responseJson: string;
  fetchedAtMs: number;
}

export interface InsertedXrcSnapshot {
  id: number;
}

export interface IXrcSnapshotRepository {
  insertSnapshot(row: XrcSnapshotToSave): Promise<InsertedXrcSnapshot>;
}

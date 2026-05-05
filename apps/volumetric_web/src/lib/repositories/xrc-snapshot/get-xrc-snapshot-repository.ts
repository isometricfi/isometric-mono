import { getD1Db } from "@/lib/db/get-d1-db";
import { DrizzleXrcSnapshotRepository } from "./drizzle-xrc-snapshot.repository";
import type { IXrcSnapshotRepository } from "./xrc-snapshot-repository.interface";

let repository: IXrcSnapshotRepository | null = null;

export function getXrcSnapshotRepository(): IXrcSnapshotRepository {
  if (repository) {
    return repository;
  }

  repository = new DrizzleXrcSnapshotRepository(getD1Db());
  return repository;
}

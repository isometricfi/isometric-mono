import type { DrizzleD1Database } from "drizzle-orm/d1";
import type * as dbSchema from "@/lib/db/schema";
import { xrcBtcUsdSnapshots } from "@/lib/db/schema";
import type {
  InsertedXrcSnapshot,
  IXrcSnapshotRepository,
  XrcSnapshotToSave,
} from "./xrc-snapshot-repository.interface";

export class DrizzleXrcSnapshotRepository implements IXrcSnapshotRepository {
  constructor(private db: DrizzleD1Database<typeof dbSchema>) {}

  async insertSnapshot(row: XrcSnapshotToSave): Promise<InsertedXrcSnapshot> {
    const inserted = await this.db
      .insert(xrcBtcUsdSnapshots)
      .values({
        fetchedAtMs: row.fetchedAtMs,
        responseJson: row.responseJson,
      })
      .returning({ id: xrcBtcUsdSnapshots.id });

    const rowOut = inserted[0];
    if (!rowOut) {
      throw new Error("XRC snapshot insert returned no row");
    }

    return { id: rowOut.id };
  }
}

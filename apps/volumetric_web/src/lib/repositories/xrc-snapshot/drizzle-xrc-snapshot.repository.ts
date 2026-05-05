import { desc } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import type * as dbSchema from "@/lib/db/schema";
import { xrcBtcUsdSnapshots } from "@/lib/db/schema";
import type {
  InsertXrcBtcUsdSnapshotInput,
  IXrcSnapshotRepository,
} from "./xrc-snapshot-repository.interface";

export class DrizzleXrcSnapshotRepository implements IXrcSnapshotRepository {
  constructor(private db: DrizzleD1Database<typeof dbSchema>) {}

  async getLatestSnapshotResponseJson(): Promise<string | null> {
    const rows = await this.db
      .select({ responseJson: xrcBtcUsdSnapshots.responseJson })
      .from(xrcBtcUsdSnapshots)
      .orderBy(desc(xrcBtcUsdSnapshots.id))
      .limit(1);

    return rows[0]?.responseJson ?? null;
  }

  async insertSnapshot(input: InsertXrcBtcUsdSnapshotInput): Promise<void> {
    await this.db.insert(xrcBtcUsdSnapshots).values({
      fetchedAtMs: input.fetchedAtMs,
      responseJson: input.responseJson,
    });
  }
}

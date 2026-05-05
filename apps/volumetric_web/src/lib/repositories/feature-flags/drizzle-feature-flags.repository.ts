import { eq } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import type { FeatureFlagKey } from "@/lib/db/feature-flag-keys";
import type * as dbSchema from "@/lib/db/schema";
import { featureFlags } from "@/lib/db/schema";
import type { IFeatureFlagsRepository } from "./feature-flags-repository.interface";

export class DrizzleFeatureFlagsRepository implements IFeatureFlagsRepository {
  constructor(private readonly db: DrizzleD1Database<typeof dbSchema>) {}

  async isEnabled(key: FeatureFlagKey): Promise<boolean> {
    const rows = await this.db
      .select({ enabled: featureFlags.enabled })
      .from(featureFlags)
      .where(eq(featureFlags.key, key))
      .limit(1);

    return rows[0]?.enabled ?? false;
  }
}

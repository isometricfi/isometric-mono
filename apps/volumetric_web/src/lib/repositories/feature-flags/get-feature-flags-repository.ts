import { getD1Db } from "@/lib/db/get-d1-db";
import { DrizzleFeatureFlagsRepository } from "./drizzle-feature-flags.repository";
import type { IFeatureFlagsRepository } from "./feature-flags-repository.interface";

let featureFlagsRepository: IFeatureFlagsRepository | null = null;

export function getFeatureFlagsRepository(): IFeatureFlagsRepository {
  if (!featureFlagsRepository) {
    featureFlagsRepository = new DrizzleFeatureFlagsRepository(getD1Db());
  }

  return featureFlagsRepository;
}

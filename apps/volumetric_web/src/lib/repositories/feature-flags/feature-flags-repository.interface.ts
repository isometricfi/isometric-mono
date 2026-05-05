import type { FeatureFlagKey } from "@/lib/db/feature-flag-keys";

export interface IFeatureFlagsRepository {
  isEnabled(key: FeatureFlagKey): Promise<boolean>;
}

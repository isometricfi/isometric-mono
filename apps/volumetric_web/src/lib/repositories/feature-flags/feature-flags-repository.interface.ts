export type FeatureFlagKey = "pause_mode";

export interface IFeatureFlagsRepository {
  isEnabled(key: FeatureFlagKey): Promise<boolean>;
}

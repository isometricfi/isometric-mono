export const FEATURE_FLAG_KEY = {
  PAUSE_MODE: "pause_mode",
} as const;

export type FeatureFlagKey = (typeof FEATURE_FLAG_KEY)[keyof typeof FEATURE_FLAG_KEY];

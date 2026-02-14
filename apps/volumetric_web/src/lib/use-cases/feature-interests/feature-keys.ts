export const FEATURE_KEYS = ["put_options"] as const;

export type FeatureKey = (typeof FEATURE_KEYS)[number];

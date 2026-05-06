import { z } from "zod";

export const outputSchema = z.object({
  success: z.literal(true),
  inserted: z.boolean(),
  skippedReason: z.enum(["empty_canister_cache", "duplicate_xrc_timestamp"]).optional(),
});

export type Output = z.infer<typeof outputSchema>;

const persistedCanisterXrcSnapshotSchema = z.object({
  source: z.literal("canister_stable_cache"),
  xrc_timestamp_seconds: z.number().int().nonnegative(),
});

export function parseLatestPersistedXrcTimestampSeconds(
  responseJson: string | null,
): number | null {
  if (responseJson === null) {
    return null;
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(responseJson);
  } catch {
    return null;
  }

  const parsed = persistedCanisterXrcSnapshotSchema.safeParse(parsedJson);
  if (!parsed.success) {
    return null;
  }

  return parsed.data.xrc_timestamp_seconds;
}

import { TRPCError } from "@trpc/server";
import { FEATURE_FLAG_KEY } from "@/lib/db/feature-flag-keys";
import { getFeatureFlagsRepository } from "@/lib/repositories/feature-flags/get-feature-flags-repository";

export async function assertNotPaused(): Promise<void> {
  const repository = getFeatureFlagsRepository();
  const paused = await repository.isEnabled(FEATURE_FLAG_KEY.PAUSE_MODE);
  if (paused) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message:
        "Trading is currently paused. New offers, accounts, accepts, and withdrawals are disabled.",
    });
  }
}

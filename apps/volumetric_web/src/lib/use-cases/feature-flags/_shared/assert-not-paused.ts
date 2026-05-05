import { TRPCError } from "@trpc/server";
import { getFeatureFlagsRepository } from "@/lib/repositories/feature-flags/get-feature-flags-repository";

export async function assertNotPaused(): Promise<void> {
  const repository = getFeatureFlagsRepository();
  const paused = await repository.isEnabled("pause_mode");
  if (paused) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Trading is currently paused. New offers, accounts, and accepts are disabled.",
    });
  }
}

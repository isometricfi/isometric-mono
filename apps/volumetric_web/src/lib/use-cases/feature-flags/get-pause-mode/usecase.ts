import { FEATURE_FLAG_KEY } from "@/lib/db/feature-flag-keys";
import { getFeatureFlagsRepository } from "@/lib/repositories/feature-flags/get-feature-flags-repository";
import { withSpan } from "@/lib/telemetry/withSpan";

const GET_PAUSE_MODE_SPAN_NAME = "usecase.feature_flags.get_pause_mode";

export interface PauseModeStatus {
  paused: boolean;
}

export async function getPauseMode(): Promise<PauseModeStatus> {
  return withSpan(GET_PAUSE_MODE_SPAN_NAME, async () => {
    const repository = getFeatureFlagsRepository();
    const paused = await repository.isEnabled(FEATURE_FLAG_KEY.PAUSE_MODE);
    return { paused };
  });
}

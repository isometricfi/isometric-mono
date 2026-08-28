import { withSpan } from "@/lib/telemetry/withSpan";

const GET_PAUSE_MODE_SPAN_NAME = "usecase.feature_flags.get_pause_mode";

export interface PauseModeStatus {
  paused: boolean;
}

export async function getPauseMode(): Promise<PauseModeStatus> {
  return withSpan(GET_PAUSE_MODE_SPAN_NAME, async () => {
    return { paused: false };
  });
}

import { getCanisterActor } from "@/lib/canister-server";
import { groupActiveOptionsByTermAndStrike } from "@/lib/options-transformer";
import { ATTR_RESULT_COUNT } from "@/lib/telemetry/traceConstants";
import { withSpan } from "@/lib/telemetry/withSpan";
import type { OptionsData } from "@/types/options";

const LIST_ACTIVE_OPTIONS_SPAN_NAME = "usecase.options.list_active_options";

export async function listActiveOptions(): Promise<OptionsData> {
  return withSpan(LIST_ACTIVE_OPTIONS_SPAN_NAME, async (span) => {
    const actor = await getCanisterActor();
    const options = await actor.get_active_options();
    const optionsData = groupActiveOptionsByTermAndStrike(options);

    span.setAttribute(ATTR_RESULT_COUNT, optionsData.termGroups.length);
    return optionsData;
  });
}

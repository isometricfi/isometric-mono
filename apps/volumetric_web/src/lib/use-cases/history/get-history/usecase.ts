import { ATTR_RESULT_COUNT } from "@/lib/telemetry/traceConstants";
import { withSpan } from "@/lib/telemetry/withSpan";
import type { Output } from "./schema";

const GET_HISTORY_SPAN_NAME = "usecase.history.get_history";

export async function getHistory(principal: string): Promise<Output> {
  return withSpan(GET_HISTORY_SPAN_NAME, async (span) => {
    void principal;
    span.setAttribute(ATTR_RESULT_COUNT, 0);
    return { entries: [] };
  });
}

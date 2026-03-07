import { getCanisterActor } from "@/lib/canister-server";
import { getEventsRepository } from "@/lib/repositories/events/get-events-repository";
import { ATTR_RESULT_COUNT } from "@/lib/telemetry/traceConstants";
import { withSpan } from "@/lib/telemetry/withSpan";
import { mapEvents } from "../get-events/mapper";

const SYNC_EVENTS_SPAN_NAME = "usecase.events.sync_events";

export interface SyncEventsResult {
  syncedCount: number;
  latestEventId: string | null;
}

export async function syncEventsFromCanister(): Promise<SyncEventsResult> {
  return withSpan(SYNC_EVENTS_SPAN_NAME, async (span) => {
    const repository = getEventsRepository();
    const actor = await getCanisterActor();

    const latestEventId = await repository.getLatestEventId();
    const afterId: [] | [bigint] = latestEventId ? [BigInt(latestEventId)] : [];

    const canisterEvents = await actor.get_all_events(afterId, [1000]);
    const events = mapEvents(canisterEvents);

    if (events.length > 0) {
      await repository.saveEvents(events);
    }

    span.setAttribute(ATTR_RESULT_COUNT, events.length);

    return {
      syncedCount: events.length,
      latestEventId: events.length > 0 ? events[events.length - 1].id : latestEventId,
    };
  });
}

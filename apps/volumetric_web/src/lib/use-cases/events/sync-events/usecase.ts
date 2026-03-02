import { getCanisterActor } from "@/lib/canister-server";
import { getEventsRepository } from "@/lib/repositories/events/get-events-repository";
import { withWebSpan } from "@/lib/telemetry";
import { mapEvents } from "../get-events/mapper";

export interface SyncEventsResult {
  syncedCount: number;
  latestEventId: string | null;
}

export async function syncEventsFromCanister(): Promise<SyncEventsResult> {
  return withWebSpan("web.usecase.sync_events", {}, async (span) => {
    const repository = getEventsRepository();
    const actor = await withWebSpan("web.usecase.sync_events.get_actor", {}, async () =>
      getCanisterActor(),
    );

    const latestEventId = await withWebSpan(
      "web.usecase.sync_events.get_latest_event_id",
      {},
      async () => repository.getLatestEventId(),
    );
    const afterId: [] | [bigint] = latestEventId ? [BigInt(latestEventId)] : [];

    const canisterEvents = await withWebSpan(
      "web.usecase.sync_events.get_all_events",
      {},
      async () => actor.get_all_events(afterId, [1000]),
    );
    const events = mapEvents(canisterEvents);

    if (events.length > 0) {
      await withWebSpan(
        "web.usecase.sync_events.save_events",
        { event_count: events.length },
        async () => repository.saveEvents(events),
      );
    }

    span.setAttribute("synced_count", events.length);

    return {
      syncedCount: events.length,
      latestEventId: events.length > 0 ? events[events.length - 1].id : latestEventId,
    };
  });
}

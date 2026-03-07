import { getEventsRepository } from "@/lib/repositories/events/get-events-repository";
import { ATTR_RESULT_COUNT } from "@/lib/telemetry/traceConstants";
import { withSpan } from "@/lib/telemetry/withSpan";
import type { Input, Output } from "./schema";

const GET_EVENTS_SPAN_NAME = "usecase.events.get_events";
const GET_EVENTS_SINCE_SPAN_NAME = "usecase.events.get_events_since";
const GET_EVENTS_FOR_PRINCIPAL_SPAN_NAME = "usecase.events.get_events_for_principal";

export async function getEvents(input: Input = {}): Promise<Output> {
  return withSpan(GET_EVENTS_SPAN_NAME, async (span) => {
    const repository = getEventsRepository();
    const events = await repository.getEvents({
      afterId: input.afterId,
      limit: input.limit,
    });

    span.setAttribute(ATTR_RESULT_COUNT, events.length);
    return events;
  });
}

export async function getEventsSince(timestampMs: number, limit?: number): Promise<Output> {
  return withSpan(GET_EVENTS_SINCE_SPAN_NAME, async (span) => {
    const repository = getEventsRepository();
    const events = await repository.getEvents({
      afterTimestamp: timestampMs,
      limit,
    });

    span.setAttribute(ATTR_RESULT_COUNT, events.length);
    return events;
  });
}

export async function getEventsForPrincipal(
  principal: string,
  afterId?: string,
  limit?: number,
): Promise<Output> {
  return withSpan(GET_EVENTS_FOR_PRINCIPAL_SPAN_NAME, async (span) => {
    const repository = getEventsRepository();
    const events = await repository.getEventsByPrincipal(principal, {
      afterId,
      limit,
    });

    span.setAttribute(ATTR_RESULT_COUNT, events.length);
    return events;
  });
}

import { getEventsRepository } from "@/lib/repositories/events/get-events-repository";
import type { Input, Output } from "./schema";

export async function getEvents(input: Input = {}): Promise<Output> {
  const repository = getEventsRepository();
  return repository.getEvents({
    afterId: input.afterId,
    limit: input.limit,
  });
}

export async function getEventsSince(timestampMs: number, limit?: number): Promise<Output> {
  const repository = getEventsRepository();
  return repository.getEvents({
    afterTimestamp: timestampMs,
    limit,
  });
}

export async function getEventsForPrincipal(
  principal: string,
  afterId?: string,
  limit?: number,
): Promise<Output> {
  const repository = getEventsRepository();
  return repository.getEventsByPrincipal(principal, {
    afterId,
    limit,
  });
}

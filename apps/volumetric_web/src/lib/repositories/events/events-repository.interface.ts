import type { Event } from "@/lib/use-cases/events/get-events/schema";

export interface EventsQuery {
  principal?: string;
  afterId?: string;
  afterTimestamp?: number;
  limit?: number;
}

export interface IEventsRepository {
  saveEvent(event: Event): Promise<void>;
  saveEvents(events: Event[]): Promise<void>;
  getEvents(query: EventsQuery): Promise<Event[]>;
  getEventsByPrincipal(principal: string, query?: Omit<EventsQuery, "principal">): Promise<Event[]>;
  getLatestEventId(principal?: string): Promise<string | null>;
}

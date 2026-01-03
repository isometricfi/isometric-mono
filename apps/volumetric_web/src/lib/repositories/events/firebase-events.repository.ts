import type { FirestoreClient } from "firebase-rest-firestore";
import type { Event } from "@/lib/use-cases/events/get-events/schema";
import type { EventsQuery, IEventsRepository } from "./events-repository.interface";

const EVENTS_COLLECTION = "events";

interface StoredEvent extends Event {
  idNum: number;
}

export class FirebaseEventsRepository implements IEventsRepository {
  constructor(private client: FirestoreClient) {}

  async saveEvent(event: Event): Promise<void> {
    const doc: StoredEvent = { ...event, idNum: Number(event.id) };
    await this.client.collection(EVENTS_COLLECTION).doc(event.id).set(doc);
  }

  async saveEvents(events: Event[]): Promise<void> {
    if (events.length === 0) return;

    const BATCH_SIZE = 500;
    for (let i = 0; i < events.length; i += BATCH_SIZE) {
      const batch = events.slice(i, i + BATCH_SIZE);
      await Promise.all(
        batch.map((event) => {
          const doc: StoredEvent = { ...event, idNum: Number(event.id) };
          return this.client.collection(EVENTS_COLLECTION).doc(event.id).set(doc);
        }),
      );
    }
  }

  async getEvents(query: EventsQuery): Promise<Event[]> {
    type WhereClause = { field: string; op: string; value: unknown };
    const where: WhereClause[] = [];

    if (query.principal) {
      where.push({ field: "principal", op: "EQUAL", value: query.principal });
    }

    if (query.afterTimestamp) {
      where.push({ field: "timestamp", op: "GREATER_THAN", value: query.afterTimestamp });
    }

    if (query.afterId) {
      const afterIdNum = Number(query.afterId);
      where.push({ field: "idNum", op: "GREATER_THAN", value: afterIdNum });
    }

    const results = await this.client.query(EVENTS_COLLECTION, {
      where: where.length > 0 ? where : undefined,
      orderBy: "idNum",
      limit: query.limit ?? 100,
    });

    return (results as StoredEvent[]).reverse();
  }

  async getEventsByPrincipal(
    principal: string,
    query: Omit<EventsQuery, "principal"> = {},
  ): Promise<Event[]> {
    return this.getEvents({ ...query, principal });
  }

  async getLatestEventId(principal?: string): Promise<string | null> {
    type WhereClause = { field: string; op: string; value: unknown };
    const where: WhereClause[] = [];

    if (principal) {
      where.push({ field: "principal", op: "EQUAL", value: principal });
    }

    const results = await this.client.query(EVENTS_COLLECTION, {
      where: where.length > 0 ? where : undefined,
      orderBy: "idNum",
      orderDirection: "DESCENDING",
      limit: 1,
    });

    const events = results as StoredEvent[];
    if (events.length === 0) return null;

    return events[0].id;
  }
}

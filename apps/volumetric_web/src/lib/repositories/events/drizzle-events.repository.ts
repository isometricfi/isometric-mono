import { and, asc, desc, eq, gt, sql } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { z } from "zod";
import type * as dbSchema from "@/lib/db/schema";
import { events } from "@/lib/db/schema";
import type { Event } from "@/lib/use-cases/events/get-events/schema";
import type { EventsQuery, IEventsRepository } from "./events-repository.interface";

const DEFAULT_EVENTS_LIMIT = 100;
const SAVE_EVENTS_BATCH_SIZE = 500;

const storedEventRowSchema = z.object({
  id: z.string(),
  idNum: z.number(),
  eventType: z.string(),
  principal: z.string(),
  timestamp: z.number(),
  dataJson: z.string(),
});

type StoredEventRow = z.infer<typeof storedEventRowSchema>;

export class DrizzleEventsRepository implements IEventsRepository {
  constructor(private db: DrizzleD1Database<typeof dbSchema>) {}

  async saveEvent(event: Event): Promise<void> {
    const insertableEvent = toInsertableEvent(event);

    await this.db.insert(events).values(insertableEvent).onConflictDoUpdate({
      target: events.id,
      set: insertableEvent,
    });
  }

  async saveEvents(eventsToSave: Event[]): Promise<void> {
    if (eventsToSave.length === 0) {
      return;
    }

    for (let i = 0; i < eventsToSave.length; i += SAVE_EVENTS_BATCH_SIZE) {
      const eventBatch = eventsToSave.slice(i, i + SAVE_EVENTS_BATCH_SIZE).map(toInsertableEvent);

      await this.db
        .insert(events)
        .values(eventBatch)
        .onConflictDoUpdate({
          target: events.id,
          set: {
            idNum: sql`excluded.id_num`,
            eventType: sql`excluded.event_type`,
            principal: sql`excluded.principal`,
            timestamp: sql`excluded.timestamp`,
            dataJson: sql`excluded.data_json`,
          },
        });
    }
  }

  async getEvents(query: EventsQuery): Promise<Event[]> {
    const whereConditions = [];

    if (query.principal) {
      whereConditions.push(eq(events.principal, query.principal));
    }

    if (query.afterTimestamp) {
      whereConditions.push(gt(events.timestamp, query.afterTimestamp));
    }

    if (query.afterId) {
      const afterIdNum = Number(query.afterId);
      if (Number.isNaN(afterIdNum)) {
        return [];
      }
      whereConditions.push(gt(events.idNum, afterIdNum));
    }

    const rows = await this.db
      .select({
        id: events.id,
        idNum: events.idNum,
        eventType: events.eventType,
        principal: events.principal,
        timestamp: events.timestamp,
        dataJson: events.dataJson,
      })
      .from(events)
      .where(whereConditions.length > 0 ? and(...whereConditions) : undefined)
      .orderBy(asc(events.idNum))
      .limit(query.limit ?? DEFAULT_EVENTS_LIMIT);

    const parsedRows = rows.map((row) => fromStoredEventRow(storedEventRowSchema.parse(row)));
    return parsedRows.reverse();
  }

  async getEventsByPrincipal(
    principal: string,
    query: Omit<EventsQuery, "principal"> = {},
  ): Promise<Event[]> {
    return this.getEvents({ ...query, principal });
  }

  async getLatestEventId(principal?: string): Promise<string | null> {
    const rows = await this.db
      .select({ id: events.id })
      .from(events)
      .where(principal ? eq(events.principal, principal) : undefined)
      .orderBy(desc(events.idNum))
      .limit(1);

    return rows[0]?.id ?? null;
  }
}

function toInsertableEvent(event: Event) {
  return {
    id: event.id,
    idNum: Number(event.id),
    eventType: event.eventType,
    principal: event.principal,
    timestamp: event.timestamp,
    dataJson: JSON.stringify(event.data),
  };
}

function fromStoredEventRow(row: StoredEventRow): Event {
  return {
    id: row.id,
    eventType: row.eventType as Event["eventType"],
    principal: row.principal,
    timestamp: row.timestamp,
    data: JSON.parse(row.dataJson) as Event["data"],
  };
}

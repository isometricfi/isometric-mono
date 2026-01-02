import type { Firestore } from "firebase-admin/firestore";
import type { Event } from "@/lib/use-cases/events/get-events/schema";
import type { EventsQuery, IEventsRepository } from "./events-repository.interface";

const EVENTS_COLLECTION = "events";
const BATCH_LIMIT = 500;

interface FirestoreEvent extends Event {
  idNum: number;
}

export class FirebaseEventsRepository implements IEventsRepository {
  constructor(private db: Firestore) {}

  async saveEvent(event: Event): Promise<void> {
    const doc: FirestoreEvent = { ...event, idNum: Number(event.id) };
    await this.db.collection(EVENTS_COLLECTION).doc(event.id).set(doc);
  }

  async saveEvents(events: Event[]): Promise<void> {
    if (events.length === 0) return;

    for (let i = 0; i < events.length; i += BATCH_LIMIT) {
      const chunk = events.slice(i, i + BATCH_LIMIT);
      const batch = this.db.batch();
      for (const event of chunk) {
        const doc: FirestoreEvent = { ...event, idNum: Number(event.id) };
        const docRef = this.db.collection(EVENTS_COLLECTION).doc(event.id);
        batch.set(docRef, doc);
      }
      await batch.commit();
    }
  }

  async getEvents(query: EventsQuery): Promise<Event[]> {
    let q = this.db.collection(EVENTS_COLLECTION).orderBy("timestamp", "desc");

    if (query.principal) {
      q = q.where("principal", "==", query.principal);
    }

    if (query.afterTimestamp) {
      q = q.where("timestamp", ">", query.afterTimestamp);
    }

    if (query.afterId) {
      const afterDoc = await this.db.collection(EVENTS_COLLECTION).doc(query.afterId).get();
      if (afterDoc.exists) {
        q = q.startAfter(afterDoc);
      }
    }

    const limit = query.limit ?? 100;
    q = q.limit(limit);

    const snapshot = await q.get();
    return snapshot.docs.map((doc) => doc.data() as Event);
  }

  async getEventsByPrincipal(
    principal: string,
    query: Omit<EventsQuery, "principal"> = {},
  ): Promise<Event[]> {
    return this.getEvents({ ...query, principal });
  }

  async getLatestEventId(principal?: string): Promise<string | null> {
    let q = this.db.collection(EVENTS_COLLECTION).orderBy("idNum", "desc").limit(1);

    if (principal) {
      q = q.where("principal", "==", principal);
    }

    const snapshot = await q.get();
    if (snapshot.empty) return null;

    const event = snapshot.docs[0].data() as Event;
    return event.id;
  }
}

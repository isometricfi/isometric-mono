import { getDb } from "@/lib/firebase";
import type { IEventsRepository } from "./events-repository.interface";
import { FirebaseEventsRepository } from "./firebase-events.repository";

let eventsRepository: IEventsRepository | null = null;

export function getEventsRepository(): IEventsRepository {
  if (!eventsRepository) {
    eventsRepository = new FirebaseEventsRepository(getDb());
  }
  return eventsRepository;
}

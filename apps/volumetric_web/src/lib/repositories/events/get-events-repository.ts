import { getFirestore } from "@/lib/firebase";
import { withWebSpanWrappedMethods } from "@/lib/telemetry";
import type { IEventsRepository } from "./events-repository.interface";
import { FirebaseEventsRepository } from "./firebase-events.repository";

let eventsRepository: IEventsRepository | null = null;

export function getEventsRepository(): IEventsRepository {
  if (!eventsRepository) {
    eventsRepository = withWebSpanWrappedMethods(
      "events_repository",
      new FirebaseEventsRepository(getFirestore()),
    );
  }
  return eventsRepository;
}

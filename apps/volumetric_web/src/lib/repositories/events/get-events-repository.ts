import { getD1Db } from "@/lib/db/get-d1-db";
import { DrizzleEventsRepository } from "./drizzle-events.repository";
import type { IEventsRepository } from "./events-repository.interface";

let eventsRepository: IEventsRepository | null = null;

export function getEventsRepository(): IEventsRepository {
  if (!eventsRepository) {
    eventsRepository = new DrizzleEventsRepository(getD1Db());
  }
  return eventsRepository;
}

import type { DrizzleD1Database } from "drizzle-orm/d1";
import { describe, expect, test, vi } from "vitest";
import type * as dbSchema from "@/lib/db/schema";
import { DrizzleEventsRepository } from "./drizzle-events.repository";

interface StoredEventRow {
  id: string;
  idNum: number;
  eventType: string;
  principal: string;
  timestamp: number;
  dataJson: string;
}

function createQueryDbMock(rows: StoredEventRow[]) {
  const limit = vi.fn().mockResolvedValue(rows);
  const orderBy = vi.fn().mockReturnValue({ limit });
  const where = vi.fn().mockReturnValue({ orderBy });
  const from = vi.fn().mockReturnValue({ where });
  const select = vi.fn().mockReturnValue({ from });

  const database = { select } as unknown as DrizzleD1Database<typeof dbSchema>;

  return {
    database,
    limit,
    orderBy,
    where,
    from,
    select,
  };
}

describe("DrizzleEventsRepository.getEvents", () => {
  test("should return newest-first contiguous page after afterId", async () => {
    // given
    const queryRowsAfterIdAscending: StoredEventRow[] = [
      {
        id: "51",
        idNum: 51,
        eventType: "Unknown",
        principal: "p1",
        timestamp: 1_700_000_001_000,
        dataJson: JSON.stringify({ type: "Unknown" }),
      },
      {
        id: "52",
        idNum: 52,
        eventType: "Unknown",
        principal: "p1",
        timestamp: 1_700_000_002_000,
        dataJson: JSON.stringify({ type: "Unknown" }),
      },
      {
        id: "53",
        idNum: 53,
        eventType: "Unknown",
        principal: "p1",
        timestamp: 1_700_000_003_000,
        dataJson: JSON.stringify({ type: "Unknown" }),
      },
    ];
    const { database } = createQueryDbMock(queryRowsAfterIdAscending);
    const repository = new DrizzleEventsRepository(database);

    // when
    const events = await repository.getEvents({
      afterId: "50",
      limit: 3,
    });

    // then
    expect(events.map((event) => event.id)).toEqual(["53", "52", "51"]);
  });
});

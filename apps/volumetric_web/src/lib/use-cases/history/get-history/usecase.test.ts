import { beforeEach, describe, expect, test, vi } from "vitest";
import type { IEventsRepository } from "@/lib/repositories/events/events-repository.interface";
import type { Event } from "@/lib/use-cases/events/get-events/schema";
import { getHistory } from "./usecase";

const PRINCIPAL = "a4jnl-aaotm-42cjq-mustg-7ujpq-m4uql-mjfuv-pa7h7-pvrci-alv7i-vqe";

const { getEventsRepositoryMock } = vi.hoisted(() => ({
  getEventsRepositoryMock: vi.fn(),
}));

vi.mock("@/lib/repositories/events/get-events-repository", () => ({
  getEventsRepository: getEventsRepositoryMock,
}));

function makeRepositoryMock(): IEventsRepository {
  return {
    saveEvent: vi.fn(),
    saveEvents: vi.fn(),
    getEvents: vi.fn(),
    getEventsByPrincipal: vi.fn(),
    getLatestEventId: vi.fn(),
  };
}

function makeValidOptionSettledEvent(overrides: Partial<Event> = {}): Event {
  return {
    id: "100",
    eventType: "OptionSettled",
    principal: PRINCIPAL,
    timestamp: 1_700_000_000,
    data: {
      type: "OptionSettled",
      optionId: "1",
      quantitySats: 100_000,
      entryPriceCents: 10_000_000,
      strikePriceCents: 11_000_000,
      settlementPriceCents: 12_000_000,
      premiumSats: 5_000,
      payoutSats: 3_000,
      acceptedAtSeconds: 1_700_000_000,
      settledAtSeconds: 1_700_000_100,
      role: "Buyer",
    },
    ...overrides,
  };
}

describe("getHistory", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("should skip OptionSettled rows with missing numeric fields and return valid entries", async () => {
    // given
    const repository = makeRepositoryMock();
    const malformed: Event = {
      id: "99",
      eventType: "OptionSettled",
      principal: PRINCIPAL,
      timestamp: 1,
      data: {
        type: "OptionSettled",
        optionId: "1",
        quantitySats: 100_000,
        strikePriceCents: 11_000_000,
        settlementPriceCents: 12_000_000,
        premiumSats: 5_000,
        payoutSats: 3_000,
        acceptedAtSeconds: 1,
        settledAtSeconds: 2,
        role: "Buyer",
      } as Event["data"],
    };
    vi.mocked(repository.getEventsByPrincipal).mockResolvedValue([
      malformed,
      makeValidOptionSettledEvent({ id: "100" }),
    ]);
    getEventsRepositoryMock.mockReturnValue(repository);

    // when
    const result = await getHistory(PRINCIPAL);

    // then
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0]?.id).toBe("100-1");
  });
});

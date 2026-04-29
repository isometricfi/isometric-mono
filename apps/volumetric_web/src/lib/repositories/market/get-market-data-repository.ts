import { getD1Db } from "@/lib/db/get-d1-db";
import { DrizzleMarketDataRepository } from "./drizzle-market-data.repository";
import type { IMarketDataRepository } from "./market-data-repository.interface";

let marketDataRepository: IMarketDataRepository | null = null;

export function getMarketDataRepository(): IMarketDataRepository {
  if (marketDataRepository) {
    return marketDataRepository;
  }

  marketDataRepository = new DrizzleMarketDataRepository(getD1Db());
  return marketDataRepository;
}

import { logError } from "@/lib/telemetry/logs";
import { outputSchema as syncMarketDataSuccessSchema } from "@/lib/use-cases/market/sync-market-data/schema";
import { syncBtcMarketData } from "@/lib/use-cases/market/sync-market-data/usecase";
import {
  createCronErrorResponse,
  createCronSuccessResponse,
  getCronAuthGuardResponse,
} from "../_lib/schemas";

export async function GET(request: Request) {
  const guardResponse = getCronAuthGuardResponse(request);
  if (guardResponse) {
    return guardResponse;
  }

  try {
    const result = await syncBtcMarketData();
    return createCronSuccessResponse(syncMarketDataSuccessSchema, result);
  } catch (error) {
    await logError("Failed to sync market data", error);
    return createCronErrorResponse("Failed to sync market data", 500);
  }
}

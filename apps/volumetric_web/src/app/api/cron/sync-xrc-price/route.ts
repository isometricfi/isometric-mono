import { logError } from "@/lib/telemetry/logs";
import { outputSchema } from "@/lib/use-cases/market/sync-xrc-price/schema";
import { syncXrcPriceSnapshot } from "@/lib/use-cases/market/sync-xrc-price/usecase";
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
    const result = await syncXrcPriceSnapshot();
    return createCronSuccessResponse(outputSchema, result);
  } catch (error) {
    await logError("Failed to sync XRC price snapshot", error);
    return createCronErrorResponse("Failed to sync XRC price snapshot", 500);
  }
}

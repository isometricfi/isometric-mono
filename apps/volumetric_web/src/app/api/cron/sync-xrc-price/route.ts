import { logError } from "@/lib/telemetry/logs";
import { outputSchema as syncXrcPriceSuccessSchema } from "@/lib/use-cases/market/sync-xrc-price/schema";
import { syncXrcPriceFromCanister } from "@/lib/use-cases/market/sync-xrc-price/usecase";
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
    const result = await syncXrcPriceFromCanister();
    return createCronSuccessResponse(syncXrcPriceSuccessSchema, result);
  } catch (error) {
    await logError("Failed to sync XRC price snapshot from canister", error);
    return createCronErrorResponse("Failed to sync XRC price snapshot from canister", 500);
  }
}

import { z } from "zod";
import { syncEventsFromCanister } from "@/lib/use-cases/events/sync-events/usecase";
import {
  createCronErrorResponse,
  createCronSuccessResponse,
  getCronAuthGuardResponse,
} from "../_lib/schemas";

const syncEventsSuccessSchema = z.object({
  success: z.literal(true),
  syncedCount: z.number(),
  latestEventId: z.string().nullable(),
});

export async function GET(request: Request) {
  const guardResponse = getCronAuthGuardResponse(request);
  if (guardResponse) {
    return guardResponse;
  }

  try {
    const result = await syncEventsFromCanister();
    return createCronSuccessResponse(syncEventsSuccessSchema, {
      success: true,
      syncedCount: result.syncedCount,
      latestEventId: result.latestEventId,
    });
  } catch (error) {
    console.error("Failed to sync events:", error);
    return createCronErrorResponse("Failed to sync events", 500);
  }
}

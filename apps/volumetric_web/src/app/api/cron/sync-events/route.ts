import { z } from "zod";
import { webLog, withWebSpan } from "@/lib/telemetry";
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
  return withWebSpan(
    "web.api.cron.sync_events",
    { method: request.method, pathname: new URL(request.url).pathname },
    async () => {
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
        const message = error instanceof Error ? error.message : String(error);
        webLog("error", "Failed to sync events", { error: message });
        return createCronErrorResponse("Failed to sync events", 500);
      }
    },
  );
}

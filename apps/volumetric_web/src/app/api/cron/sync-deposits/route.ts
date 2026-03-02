import { z } from "zod";
import { webLog, withWebSpan } from "@/lib/telemetry";
import { syncDepositsFromCanister } from "@/lib/use-cases/account/sync-deposits/usecase";
import {
  createCronErrorResponse,
  createCronSuccessResponse,
  getCronAuthGuardResponse,
} from "../_lib/schemas";

const syncDepositsSuccessSchema = z.object({
  success: z.literal(true),
  usersScanned: z.number(),
  maturedDetected: z.number(),
  syncCalls: z.number(),
  creditedDeposits: z.number(),
  snapshotsSaved: z.number(),
});

export async function GET(request: Request) {
  return withWebSpan(
    "web.api.cron.sync_deposits",
    { method: request.method, pathname: new URL(request.url).pathname },
    async () => {
      const guardResponse = getCronAuthGuardResponse(request);
      if (guardResponse) {
        return guardResponse;
      }

      try {
        const result = await syncDepositsFromCanister();
        return createCronSuccessResponse(syncDepositsSuccessSchema, {
          success: true,
          usersScanned: result.usersScanned,
          maturedDetected: result.maturedDetected,
          syncCalls: result.syncCalls,
          creditedDeposits: result.creditedDeposits,
          snapshotsSaved: result.snapshotsSaved,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        webLog("error", "Failed to sync deposits", { error: message });
        return createCronErrorResponse("Failed to sync deposits", 500);
      }
    },
  );
}

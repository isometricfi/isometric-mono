import { z } from "zod";
import { logError } from "@/lib/telemetry/logs";
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
  detectionFailures: z.number(),
  syncCalls: z.number(),
  creditedDeposits: z.number(),
  snapshotsSaved: z.number(),
  reconciliationFailures: z.number(),
});

export async function GET(request: Request) {
  const guardResponse = getCronAuthGuardResponse(request);
  if (guardResponse) {
    return guardResponse;
  }

  try {
    const result = await syncDepositsFromCanister({ logFailure: logError });
    return createCronSuccessResponse(syncDepositsSuccessSchema, {
      success: true,
      usersScanned: result.usersScanned,
      maturedDetected: result.maturedDetected,
      detectionFailures: result.detectionFailures,
      syncCalls: result.syncCalls,
      creditedDeposits: result.creditedDeposits,
      snapshotsSaved: result.snapshotsSaved,
      reconciliationFailures: result.reconciliationFailures,
    });
  } catch (error) {
    await logError("Failed to sync deposits", error);
    return createCronErrorResponse("Failed to sync deposits", 500);
  }
}

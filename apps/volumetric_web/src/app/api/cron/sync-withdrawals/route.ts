import { z } from "zod";
import { logError } from "@/lib/telemetry/logs";
import { syncWithdrawalsFromCanister } from "@/lib/use-cases/account/sync-withdrawals/usecase";
import {
  createCronErrorResponse,
  createCronSuccessResponse,
  getCronAuthGuardResponse,
} from "../_lib/schemas";

const syncWithdrawalsSuccessSchema = z.object({
  success: z.literal(true),
  rowsProcessed: z.number(),
  blockIndexResolved: z.number(),
  txidResolved: z.number(),
  completed: z.number(),
  failed: z.number(),
  expired: z.number(),
});

export async function GET(request: Request) {
  const guardResponse = getCronAuthGuardResponse(request);
  if (guardResponse) {
    return guardResponse;
  }

  try {
    const result = await syncWithdrawalsFromCanister();
    return createCronSuccessResponse(syncWithdrawalsSuccessSchema, {
      success: true,
      rowsProcessed: result.rowsProcessed,
      blockIndexResolved: result.blockIndexResolved,
      txidResolved: result.txidResolved,
      completed: result.completed,
      failed: result.failed,
      expired: result.expired,
    });
  } catch (error) {
    await logError("Failed to sync withdrawals", error);
    return createCronErrorResponse("Failed to sync withdrawals", 500);
  }
}

import { NextResponse } from "next/server";
import { z } from "zod";
import { syncDepositsFromCanister } from "@/lib/use-cases/account/sync-deposits/usecase";
import { cronErrorSchema, isAuthorizedCronRequest } from "../_lib/schemas";

const syncDepositsSuccessSchema = z.object({
  success: z.literal(true),
  usersScanned: z.number(),
  maturedDetected: z.number(),
  syncCalls: z.number(),
  creditedDeposits: z.number(),
  snapshotsSaved: z.number(),
});

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    const payload = cronErrorSchema.parse({ error: "Server misconfigured" });
    return NextResponse.json(payload, { status: 500 });
  }

  if (!isAuthorizedCronRequest(request, cronSecret)) {
    const payload = cronErrorSchema.parse({ error: "Unauthorized" });
    return NextResponse.json(payload, { status: 401 });
  }

  try {
    const result = await syncDepositsFromCanister();
    const payload = syncDepositsSuccessSchema.parse({
      success: true,
      usersScanned: result.usersScanned,
      maturedDetected: result.maturedDetected,
      syncCalls: result.syncCalls,
      creditedDeposits: result.creditedDeposits,
      snapshotsSaved: result.snapshotsSaved,
    });
    return NextResponse.json(payload);
  } catch (error) {
    console.error("Failed to sync deposits:", error);
    const payload = cronErrorSchema.parse({ error: "Failed to sync deposits" });
    return NextResponse.json(payload, { status: 500 });
  }
}

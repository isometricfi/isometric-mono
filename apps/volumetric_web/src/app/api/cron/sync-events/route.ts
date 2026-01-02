import { NextResponse } from "next/server";
import { syncEventsFromCanister } from "@/lib/use-cases/events/sync-events/usecase";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await syncEventsFromCanister();
    return NextResponse.json({
      success: true,
      syncedCount: result.syncedCount,
      latestEventId: result.latestEventId,
    });
  } catch (error) {
    console.error("Failed to sync events:", error);
    return NextResponse.json({ error: "Failed to sync events" }, { status: 500 });
  }
}

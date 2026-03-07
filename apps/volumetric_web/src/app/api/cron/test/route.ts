import { NextResponse } from "next/server";
import { logInfo } from "@/lib/telemetry/logs";

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await logInfo("Test cron: I've been hit");

  return NextResponse.json({ success: true, message: "I've been hit" });
}

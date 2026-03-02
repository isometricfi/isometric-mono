import { NextResponse } from "next/server";
import { webLog, withWebSpan } from "@/lib/telemetry";

export async function GET(request: Request) {
  return withWebSpan(
    "web.api.cron.test",
    { method: request.method, pathname: new URL(request.url).pathname },
    async () => {
      const cronSecret = process.env.CRON_SECRET;
      if (!cronSecret) {
        return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
      }

      const authHeader = request.headers.get("authorization");
      if (authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      webLog("info", "Test cron hit");

      return NextResponse.json({ success: true, message: "I've been hit" });
    },
  );
}

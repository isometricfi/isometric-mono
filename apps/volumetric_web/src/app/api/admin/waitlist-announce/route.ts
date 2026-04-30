import { NextResponse } from "next/server";
import { z } from "zod";
import { logError } from "@/lib/telemetry/logs";
import { sendWaitlistAnnouncement } from "@/lib/use-cases/waitlist/announce/usecase";
import { getEmailAdminAuthGuardResponse } from "../_lib/auth";

const requestSchema = z.object({
  emails: z.array(z.email()).min(1),
  appUrl: z.url(),
  dryRun: z.boolean().optional(),
});

export async function POST(request: Request) {
  const guardResponse = getEmailAdminAuthGuardResponse(request);
  if (guardResponse) {
    return guardResponse;
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: z.treeifyError(parsed.error) },
      { status: 400 },
    );
  }

  try {
    const result = await sendWaitlistAnnouncement(parsed.data);
    return NextResponse.json(result);
  } catch (error) {
    await logError("Failed to send waitlist announcement", error);
    return NextResponse.json({ error: "Failed to send announcement" }, { status: 500 });
  }
}

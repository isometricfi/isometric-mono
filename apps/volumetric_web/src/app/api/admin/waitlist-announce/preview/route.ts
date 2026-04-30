import { NextResponse } from "next/server";
import { z } from "zod";
import { renderWaitlistAnnouncement } from "@/lib/email/templates/waitlist-announcement";
import { getEmailAdminAuthGuardResponse } from "../../_lib/auth";

const appUrlSchema = z.url();

export async function GET(request: Request) {
  const guardResponse = getEmailAdminAuthGuardResponse(request, "browser");
  if (guardResponse) {
    return guardResponse;
  }

  const url = new URL(request.url);
  const format = url.searchParams.get("format");
  const rawAppUrl = url.searchParams.get("appUrl");

  let appUrl: string | undefined;
  if (rawAppUrl !== null) {
    const parsed = appUrlSchema.safeParse(rawAppUrl);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid appUrl" }, { status: 400 });
    }
    appUrl = parsed.data;
  }

  const { subject, html, text } = renderWaitlistAnnouncement(appUrl ? { appUrl } : {});

  if (format === "json") {
    return NextResponse.json({ subject, html, text });
  }

  if (format === "text") {
    return new NextResponse(text, {
      status: 200,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }

  return new NextResponse(html, {
    status: 200,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

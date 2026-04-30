import { NextResponse } from "next/server";
import { renderWaitlistAnnouncement } from "@/lib/email/templates/waitlist-announcement";
import { getEmailAdminAuthGuardResponse } from "../../_lib/auth";

export async function GET(request: Request) {
  const guardResponse = getEmailAdminAuthGuardResponse(request);
  if (guardResponse) {
    return guardResponse;
  }

  const url = new URL(request.url);
  const format = url.searchParams.get("format");
  const appUrl = url.searchParams.get("appUrl") ?? undefined;
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

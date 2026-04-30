import { NextResponse } from "next/server";

export function getEmailAdminAuthGuardResponse(request: Request): NextResponse | null {
  const secret = process.env.EMAIL_ADMIN_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  if (!isAuthorized(request, secret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return null;
}

export function isEmailAdminAuthorized(request: Request): boolean {
  const secret = process.env.EMAIL_ADMIN_SECRET;
  if (!secret) return false;
  return isAuthorized(request, secret);
}

function isAuthorized(request: Request, secret: string): boolean {
  const headerValue = request.headers.get("authorization");
  if (headerValue === `Bearer ${secret}`) return true;

  const url = new URL(request.url);
  const querySecret = url.searchParams.get("secret");
  return querySecret === secret;
}

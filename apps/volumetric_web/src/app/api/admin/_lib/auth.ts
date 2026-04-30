import { NextResponse } from "next/server";

export type AdminAuthMode = "header-only" | "browser";

export function getEmailAdminAuthGuardResponse(
  request: Request,
  mode: AdminAuthMode = "header-only",
): NextResponse | null {
  const secret = process.env.EMAIL_ADMIN_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  if (isAuthorized(request, secret)) {
    return null;
  }

  if (mode === "browser") {
    return new NextResponse("Unauthorized", {
      status: 401,
      headers: {
        "WWW-Authenticate": 'Basic realm="email-admin", charset="UTF-8"',
        "content-type": "text/plain; charset=utf-8",
      },
    });
  }

  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

function isAuthorized(request: Request, secret: string): boolean {
  const headerValue = request.headers.get("authorization");
  if (!headerValue) return false;

  if (headerValue === `Bearer ${secret}`) return true;

  if (headerValue.startsWith("Basic ")) {
    const decoded = decodeBasicAuth(headerValue.slice("Basic ".length));
    if (!decoded) return false;
    return decoded.password === secret;
  }

  return false;
}

function decodeBasicAuth(encoded: string): { username: string; password: string } | null {
  try {
    const decoded = atob(encoded);
    const colonIdx = decoded.indexOf(":");
    if (colonIdx === -1) return null;
    return {
      username: decoded.slice(0, colonIdx),
      password: decoded.slice(colonIdx + 1),
    };
  } catch {
    return null;
  }
}

import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json(
    { error: "Use /api/account/sync-balance/update endpoint" },
    { status: 404 },
  );
}

export async function POST() {
  return NextResponse.json(
    { error: "Use /api/account/sync-balance/update endpoint" },
    { status: 404 },
  );
}

import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    canisterId: process.env.CANISTER_ID,
    icHost: process.env.IC_HOST || "https://ic0.app",
  });
}


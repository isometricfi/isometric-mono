import { CanisterError, getErrorMessage } from "@volumetric/canister-types";
import { NextResponse } from "next/server";
import type { z } from "zod";

type Handler<TRequest, TResponse> = (data: TRequest) => Promise<TResponse>;

export function createApiHandler<TRequest, TResponse>(
  requestSchema: z.ZodType<TRequest>,
  handler: Handler<TRequest, TResponse>,
) {
  return async (request: Request) => {
    const parseResult = requestSchema.safeParse(await request.json());

    if (!parseResult.success) {
      return NextResponse.json(
        { error: parseResult.error.issues[0]?.message ?? "Invalid request" },
        { status: 400 },
      );
    }

    try {
      const response = await handler(parseResult.data);
      return NextResponse.json(response);
    } catch (error) {
      if (error instanceof CanisterError) {
        return NextResponse.json({ error: getErrorMessage(error) }, { status: 400 });
      }
      console.error("API error:", error);
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Internal server error" },
        { status: 500 },
      );
    }
  };
}

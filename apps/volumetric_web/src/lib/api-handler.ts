import { CanisterError, getErrorMessage } from "@volumetric/canister-types";
import { NextResponse } from "next/server";
import { z } from "zod";

/**
 * Validates request data against search params (GET/DELETE) or JSON body (POST/PUT/PATCH).
 * Also supports hybrid requests where body overrides query params.
 */
export async function validateRequest<T>(request: Request, schema: z.ZodType<T>): Promise<T> {
  const url = new URL(request.url);
  const params: Record<string, string | string[]> = {};

  for (const [key, value] of url.searchParams.entries()) {
    const existing = params[key];
    if (existing !== undefined) {
      params[key] = Array.isArray(existing) ? [...existing, value] : [existing, value];
    } else {
      params[key] = value;
    }
  }

  const method = request.method.toUpperCase();
  let data: unknown = params;

  if (method !== "GET" && method !== "HEAD") {
    try {
      const text = await request.text();
      if (text) {
        const body = JSON.parse(text);
        if (typeof body === "object" && body !== null && !Array.isArray(body)) {
          data = { ...params, ...body };
        } else {
          data = body;
        }
      }
    } catch {
      // Ignore JSON parse errors for body, fallback to params or empty
    }
  }

  const parseResult = schema.safeParse(data);

  if (!parseResult.success) {
    // Throwing ZodError directly to be caught by the wrapper
    throw parseResult.error;
  }

  return parseResult.data;
}

/**
 * Wraps a route handler with error handling for Zod validation and Canister errors.
 */
export function withApiHandler(handler: (request: Request) => Promise<Response>) {
  return async (request: Request) => {
    try {
      return await handler(request);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json(
          { error: error.issues[0]?.message ?? "Invalid request" },
          { status: 400 },
        );
      }

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

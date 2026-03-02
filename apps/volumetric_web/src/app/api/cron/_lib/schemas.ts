import { NextResponse } from "next/server";
import { z } from "zod";

export const cronAuthHeaderSchema = z.object({
  authorization: z.string().min(1),
});

export const cronErrorSchema = z.object({
  error: z.string(),
});

export function isAuthorizedCronRequest(request: Request, cronSecret: string): boolean {
  const parsedHeaders = cronAuthHeaderSchema.safeParse({
    authorization: request.headers.get("authorization"),
  });

  if (!parsedHeaders.success) {
    return false;
  }

  return parsedHeaders.data.authorization === `Bearer ${cronSecret}`;
}

export function createCronErrorResponse(error: string, status: number) {
  const payload = cronErrorSchema.parse({ error });
  return NextResponse.json(payload, { status });
}

export function createCronSuccessResponse<T>(schema: z.ZodType<T>, payload: unknown) {
  return NextResponse.json(schema.parse(payload));
}

export function getCronAuthGuardResponse(request: Request): NextResponse | null {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return createCronErrorResponse("Server misconfigured", 500);
  }

  if (!isAuthorizedCronRequest(request, cronSecret)) {
    return createCronErrorResponse("Unauthorized", 401);
  }

  return null;
}

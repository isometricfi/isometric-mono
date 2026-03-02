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

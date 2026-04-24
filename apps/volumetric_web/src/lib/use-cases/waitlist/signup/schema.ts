import { z } from "zod";

export const inputSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  locale: z.string().max(10).optional(),
});

export type Input = z.infer<typeof inputSchema>;

export interface Output {
  ok: true;
  alreadySignedUp: boolean;
}

import { z } from "zod";

export const inputSchema = z.object({
  address: z.string().min(1),
});

export type Input = z.infer<typeof inputSchema>;

export interface Output {
  success: true;
}

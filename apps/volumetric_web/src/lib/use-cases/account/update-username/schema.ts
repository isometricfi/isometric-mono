import { z } from "zod";

export const inputSchema = z.object({
  address: z.string().min(1),
  signature: z.string().min(1),
  username: z.string().min(1),
});

export type Input = z.infer<typeof inputSchema>;

export interface Output {
  principal: string;
  subaccount: number[];
  address: string;
  username: string | null;
}

import { z } from "zod";
import type { HistoryEntry } from "../get-history/schema";

export const inputSchema = z.object({
  principalHash: z.string().min(1),
});

export type Input = z.infer<typeof inputSchema>;

export interface HistoryByHashOutput {
  entries: HistoryEntry[];
  username?: string | null;
  principal?: string;
  address?: string;
}

export type { HistoryEntry };

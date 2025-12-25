import { z } from "zod";

// Request
export const CreateAccountRequestSchema = z.object({
  address: z.string().min(1),
  signature: z.string().min(1),
});

export type CreateAccountRequest = z.infer<typeof CreateAccountRequestSchema>;

// Response
export const CreateAccountResponseSchema = z.object({
  principal: z.string(),
  subaccount: z.array(z.number()),
  address: z.string(),
  username: z.string().nullable(),
});

export type CreateAccountResponse = z.infer<typeof CreateAccountResponseSchema>;

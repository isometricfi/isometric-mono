import { z } from "zod";

// Request
export const UpdateUsernameRequestSchema = z.object({
  address: z.string().min(1),
  signature: z.string().min(1),
  username: z.string().min(1),
});

export type UpdateUsernameRequest = z.infer<typeof UpdateUsernameRequestSchema>;

// Response
export const UpdateUsernameResponseSchema = z.object({
  principal: z.string(),
  subaccount: z.array(z.number()),
  address: z.string(),
  username: z.string().nullable(),
});

export type UpdateUsernameResponse = z.infer<typeof UpdateUsernameResponseSchema>;

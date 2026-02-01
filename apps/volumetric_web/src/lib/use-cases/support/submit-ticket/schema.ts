import { z } from "zod";

export const inputSchema = z.object({
  subject: z.string().min(1, "Subject is required"),
  customSubject: z.string().optional(),
  message: z.string().min(10, "Message must be at least 10 characters"),
  email: z.string().email("Valid email is required"),
  userId: z.string().min(1, "User ID is required"),
  walletAddress: z.string().min(1, "Wallet address is required"),
  attachments: z
    .array(
      z.object({
        filename: z.string(),
        content: z.string(), // base64 encoded
        contentType: z.string(),
      }),
    )
    .optional(),
});

export type Input = z.infer<typeof inputSchema>;

export const outputSchema = z.object({
  success: z.boolean(),
  ticketId: z.string().optional(),
  error: z.string().optional(),
});

export type Output = z.infer<typeof outputSchema>;

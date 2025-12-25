import { z } from "zod";

// Request
export const TestingExpireOptionRequestSchema = z.object({
  optionId: z.string(),
});

export type TestingExpireOptionRequest = z.infer<typeof TestingExpireOptionRequestSchema>;

// Response
export const TestingExpireOptionResponseSchema = z.object({
  optionId: z.string(),
  expiry: z.string(),
});

export type TestingExpireOptionResponse = z.infer<typeof TestingExpireOptionResponseSchema>;

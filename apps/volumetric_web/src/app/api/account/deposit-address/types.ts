import { z } from "zod";

// Request
export const DepositAddressRequestSchema = z.object({
  address: z.string().min(1),
});

export type DepositAddressRequest = z.infer<typeof DepositAddressRequestSchema>;

// Response
export const DepositAddressResponseSchema = z.object({
  btcAddress: z.string(),
  account: z.object({
    owner: z.string(),
    subaccount: z.array(z.number()).nullable(),
  }),
});

export type DepositAddressResponse = z.infer<typeof DepositAddressResponseSchema>;

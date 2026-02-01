import { inputSchema } from "@/lib/use-cases/support/submit-ticket/schema";
import { submitTicket } from "@/lib/use-cases/support/submit-ticket/usecase";
import { publicProcedure, router } from "../init";

export const supportRouter = router({
  submitTicket: publicProcedure.input(inputSchema).mutation(({ input }) => submitTicket(input)),
});

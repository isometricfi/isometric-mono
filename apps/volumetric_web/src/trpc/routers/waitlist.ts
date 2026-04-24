import { inputSchema as signupSchema } from "@/lib/use-cases/waitlist/signup/schema";
import { signupForWaitlist } from "@/lib/use-cases/waitlist/signup/usecase";
import { publicProcedure, router } from "../init";

export const waitlistRouter = router({
  signup: publicProcedure.input(signupSchema).mutation(({ input }) => signupForWaitlist(input)),
});

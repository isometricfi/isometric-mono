import { inputSchema as signupSchema } from "@/lib/use-cases/waitlist/signup/schema";
import { signupForWaitlist } from "@/lib/use-cases/waitlist/signup/usecase";
import { publicProcedure, router } from "../init";

async function hashIp(ip: string): Promise<string> {
  const data = new TextEncoder().encode(ip);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 32);
}

export const waitlistRouter = router({
  signup: publicProcedure.input(signupSchema).mutation(async ({ input, ctx }) => {
    const ip =
      ctx.req?.headers.get("cf-connecting-ip") ?? ctx.req?.headers.get("x-forwarded-for") ?? null;
    const ipHash = ip ? await hashIp(ip.split(",")[0]!.trim()) : undefined;
    return signupForWaitlist(input, { ipHash });
  }),
});

import { z } from "zod";
import { inputSchema } from "@/lib/use-cases/events/get-events/schema";
import {
  getEvents,
  getEventsForPrincipal,
  getEventsSince,
} from "@/lib/use-cases/events/get-events/usecase";
import { syncEventsFromCanister } from "@/lib/use-cases/events/sync-events/usecase";
import { publicProcedure, router } from "../init";

export const eventsRouter = router({
  getAll: publicProcedure.input(inputSchema).query(({ input }) => getEvents(input)),

  getSince: publicProcedure
    .input(z.object({ timestampMs: z.number(), limit: z.number().optional() }))
    .query(({ input }) => getEventsSince(input.timestampMs, input.limit)),

  getForPrincipal: publicProcedure
    .input(
      z.object({
        principal: z.string(),
        afterId: z.string().optional(),
        limit: z.number().optional(),
      }),
    )
    .query(({ input }) => getEventsForPrincipal(input.principal, input.afterId, input.limit)),

  syncAll: publicProcedure.mutation(() => syncEventsFromCanister()),
});

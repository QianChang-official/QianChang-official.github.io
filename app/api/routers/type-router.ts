import { z } from "zod";
import { createRouter, publicQuery, adminQuery } from "../middleware";
import { getDb } from "../queries/connection";
import { types } from "@db/schema";
import { eq } from "drizzle-orm";

export const typeRouter = createRouter({
  list: publicQuery.query(async () => {
    const db = getDb();
    return db.select().from(types).orderBy(types.name);
  }),

  create: adminQuery
    .input(z.object({ name: z.string().min(1) }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const result = await db.insert(types).values(input);
      return result;
    }),

  update: adminQuery
    .input(z.object({ id: z.number(), name: z.string().min(1) }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.update(types).set({ name: input.name }).where(eq(types.id, input.id));
      return { success: true };
    }),

  delete: adminQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.delete(types).where(eq(types.id, input.id));
      return { success: true };
    }),
});

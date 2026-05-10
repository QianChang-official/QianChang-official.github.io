import { z } from "zod";
import { createRouter, publicQuery, adminQuery } from "../middleware";
import { getDb } from "../queries/connection";
import { friends } from "@db/schema";
import { eq, desc } from "drizzle-orm";

export const friendRouter = createRouter({
  list: publicQuery.query(async () => {
    const db = getDb();
    return db.select().from(friends).orderBy(desc(friends.createdAt));
  }),

  create: adminQuery
    .input(
      z.object({
        blogName: z.string().min(1),
        blogAddress: z.string().url(),
        pictureAddress: z.string().url(),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const result = await db.insert(friends).values(input);
      return result;
    }),

  update: adminQuery
    .input(
      z.object({
        id: z.number(),
        blogName: z.string().optional(),
        blogAddress: z.string().optional(),
        pictureAddress: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const { id, ...data } = input;
      await db.update(friends).set(data).where(eq(friends.id, id));
      return { success: true };
    }),

  delete: adminQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.delete(friends).where(eq(friends.id, input.id));
      return { success: true };
    }),
});

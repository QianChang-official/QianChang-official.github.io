import { z } from "zod";
import { createRouter, publicQuery, adminQuery } from "../middleware";
import { getDb } from "../queries/connection";
import { pictures } from "@db/schema";
import { eq, desc } from "drizzle-orm";

export const pictureRouter = createRouter({
  list: publicQuery.query(async () => {
    const db = getDb();
    return db.select().from(pictures).orderBy(desc(pictures.id));
  }),

  create: adminQuery
    .input(
      z.object({
        pictureAddress: z.string().url(),
        pictureName: z.string().optional(),
        pictureDescription: z.string().optional(),
        pictureTime: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const result = await db.insert(pictures).values(input);
      return result;
    }),

  update: adminQuery
    .input(
      z.object({
        id: z.number(),
        pictureName: z.string().optional(),
        pictureDescription: z.string().optional(),
        pictureTime: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const { id, ...data } = input;
      await db.update(pictures).set(data).where(eq(pictures.id, id));
      return { success: true };
    }),

  delete: adminQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.delete(pictures).where(eq(pictures.id, input.id));
      return { success: true };
    }),
});

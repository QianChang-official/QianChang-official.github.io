import { z } from "zod";
import { createRouter, publicQuery, adminQuery } from "../middleware";
import { getDb } from "../queries/connection";
import { messages } from "@db/schema";
import { eq, desc } from "drizzle-orm";

export const messageRouter = createRouter({
  list: publicQuery.query(async () => {
    const db = getDb();
    return db.select().from(messages).orderBy(desc(messages.createdAt));
  }),

  create: publicQuery
    .input(
      z.object({
        nickname: z.string().min(1),
        email: z.string().email(),
        content: z.string().min(1),
        parentMessageId: z.number().optional(),
        avatar: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const avatar = input.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${input.nickname}`;
      const result = await db.insert(messages).values({
        ...input,
        avatar,
      });
      return result;
    }),

  delete: adminQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.delete(messages).where(eq(messages.id, input.id));
      return { success: true };
    }),
});

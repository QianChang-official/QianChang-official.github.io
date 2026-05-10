import { z } from "zod";
import { createRouter, publicQuery, adminQuery } from "../middleware";
import { getDb } from "../queries/connection";
import { comments } from "@db/schema";
import { eq, desc } from "drizzle-orm";

export const commentRouter = createRouter({
  listByBlog: publicQuery
    .input(z.object({ blogId: z.number() }))
    .query(async ({ input }) => {
      const db = getDb();
      return db.select().from(comments)
        .where(eq(comments.blogId, input.blogId))
        .orderBy(desc(comments.createdAt));
    }),

  create: publicQuery
    .input(
      z.object({
        nickname: z.string().min(1),
        email: z.string().email(),
        content: z.string().min(1),
        blogId: z.number(),
        parentCommentId: z.number().optional(),
        avatar: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const avatar = input.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${input.nickname}`;
      const result = await db.insert(comments).values({
        ...input,
        avatar,
      });
      return result;
    }),

  delete: adminQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.delete(comments).where(eq(comments.id, input.id));
      return { success: true };
    }),
});

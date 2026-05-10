import { z } from "zod";
import { createRouter, publicQuery, adminQuery } from "../middleware";
import { getDb } from "../queries/connection";
import { blogs, types, comments } from "@db/schema";
import { eq, like, desc, sql, and, or } from "drizzle-orm";

export const blogRouter = createRouter({
  list: publicQuery
    .input(
      z.object({
        page: z.number().default(1),
        pageSize: z.number().default(10),
        keyword: z.string().optional(),
        typeId: z.number().optional(),
      }).optional()
    )
    .query(async ({ input }) => {
      const db = getDb();
      const page = input?.page ?? 1;
      const pageSize = input?.pageSize ?? 10;
      const offset = (page - 1) * pageSize;

      const conditions = [];
      if (input?.keyword) {
        conditions.push(or(
          like(blogs.title, `%${input.keyword}%`),
          like(blogs.description, `%${input.keyword}%`)
        ));
      }
      if (input?.typeId) {
        conditions.push(eq(blogs.typeId, input.typeId));
      }

      const where = conditions.length > 0 ? and(...conditions) : undefined;

      const [items, countResult] = await Promise.all([
        db.select({
          id: blogs.id,
          title: blogs.title,
          content: blogs.content,
          description: blogs.description,
          firstPicture: blogs.firstPicture,
          flag: blogs.flag,
          views: blogs.views,
          recommend: blogs.recommend,
          published: blogs.published,
          typeId: blogs.typeId,
          createdAt: blogs.createdAt,
          updatedAt: blogs.updatedAt,
        })
          .from(blogs)
          .where(where)
          .orderBy(desc(blogs.createdAt))
          .limit(pageSize)
          .offset(offset),
        db.select({ count: sql<number>`count(*)` }).from(blogs).where(where),
      ]);

      return { items, total: countResult[0]?.count ?? 0 };
    }),

  getById: publicQuery
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = getDb();
      const blogResult = await db.select().from(blogs).where(eq(blogs.id, input.id));
      if (!blogResult[0]) return null;

      const typeResult = blogResult[0].typeId
        ? await db.select().from(types).where(eq(types.id, blogResult[0].typeId))
        : [];

      const commentResult = await db.select().from(comments).where(eq(comments.blogId, input.id));

      return {
        ...blogResult[0],
        type: typeResult[0] ?? null,
        comments: commentResult,
      };
    }),

  create: adminQuery
    .input(
      z.object({
        title: z.string().min(1),
        content: z.string(),
        description: z.string().optional(),
        firstPicture: z.string().optional(),
        flag: z.string().optional(),
        typeId: z.number(),
        appreciation: z.boolean().optional(),
        commentabled: z.boolean().optional(),
        recommend: z.boolean().optional(),
        published: z.boolean().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const result = await db.insert(blogs).values({
        ...input,
        userId: ctx.user.id,
      });
      return result;
    }),

  update: adminQuery
    .input(
      z.object({
        id: z.number(),
        title: z.string().optional(),
        content: z.string().optional(),
        description: z.string().optional(),
        firstPicture: z.string().optional(),
        flag: z.string().optional(),
        typeId: z.number().optional(),
        appreciation: z.boolean().optional(),
        commentabled: z.boolean().optional(),
        recommend: z.boolean().optional(),
        published: z.boolean().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const { id, ...data } = input;
      await db.update(blogs).set(data).where(eq(blogs.id, id));
      return { success: true };
    }),

  delete: adminQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.delete(blogs).where(eq(blogs.id, input.id));
      return { success: true };
    }),

  incrementViews: publicQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.update(blogs)
        .set({ views: sql`${blogs.views} + 1` })
        .where(eq(blogs.id, input.id));
      return { success: true };
    }),

  recommendList: publicQuery.query(async () => {
    const db = getDb();
    return db.select().from(blogs)
      .where(eq(blogs.recommend, true))
      .orderBy(desc(blogs.createdAt))
      .limit(6);
  }),
});

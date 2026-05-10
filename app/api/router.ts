import { authRouter } from "./auth-router";
import { createRouter, publicQuery } from "./middleware";
import { blogRouter } from "./routers/blog-router";
import { typeRouter } from "./routers/type-router";
import { commentRouter } from "./routers/comment-router";
import { messageRouter } from "./routers/message-router";
import { friendRouter } from "./routers/friend-router";
import { pictureRouter } from "./routers/picture-router";

export const appRouter = createRouter({
  ping: publicQuery.query(() => ({ ok: true, ts: Date.now() })),
  auth: authRouter,
  blog: blogRouter,
  type: typeRouter,
  comment: commentRouter,
  message: messageRouter,
  friend: friendRouter,
  picture: pictureRouter,
});

export type AppRouter = typeof appRouter;

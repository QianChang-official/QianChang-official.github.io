import {
  mysqlTable,
  mysqlEnum,
  serial,
  varchar,
  text,
  timestamp,
  bigint,
  int,
  boolean,
} from "drizzle-orm/mysql-core";

// ============ Users (OAuth) ============
export const users = mysqlTable("users", {
  id: serial("id").primaryKey(),
  unionId: varchar("unionId", { length: 255 }).notNull().unique(),
  name: varchar("name", { length: 255 }),
  email: varchar("email", { length: 320 }),
  avatar: text("avatar"),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
  lastSignInAt: timestamp("lastSignInAt").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ============ Blog Types ============
export const types = mysqlTable("types", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
});

export type Type = typeof types.$inferSelect;

// ============ Blogs ============
export const blogs = mysqlTable("blogs", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  content: text("content"),
  description: varchar("description", { length: 255 }),
  firstPicture: varchar("first_picture", { length: 255 }),
  flag: varchar("flag", { length: 255 }),
  views: int("views").default(0),
  appreciation: boolean("appreciation").default(false),
  commentabled: boolean("commentabled").default(true),
  published: boolean("published").default(true),
  recommend: boolean("recommend").default(false),
  typeId: bigint("type_id", { mode: "number", unsigned: true }).references(() => types.id),
  userId: bigint("user_id", { mode: "number", unsigned: true }).references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()),
});

export type Blog = typeof blogs.$inferSelect;

// ============ Comments ============
export const comments = mysqlTable("comments", {
  id: serial("id").primaryKey(),
  nickname: varchar("nickname", { length: 255 }),
  email: varchar("email", { length: 255 }),
  content: varchar("content", { length: 255 }),
  avatar: varchar("avatar", { length: 255 }),
  blogId: bigint("blog_id", { mode: "number", unsigned: true }).references(() => blogs.id),
  parentCommentId: bigint("parent_comment_id", { mode: "number", unsigned: true }),
  adminComment: boolean("admin_comment").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export type Comment = typeof comments.$inferSelect;

// ============ Messages ============
export const messages = mysqlTable("messages", {
  id: serial("id").primaryKey(),
  nickname: varchar("nickname", { length: 255 }),
  email: varchar("email", { length: 255 }),
  content: varchar("content", { length: 255 }),
  avatar: varchar("avatar", { length: 255 }),
  parentMessageId: bigint("parent_message_id", { mode: "number", unsigned: true }),
  adminMessage: boolean("admin_message").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export type Message = typeof messages.$inferSelect;

// ============ Friends ============
export const friends = mysqlTable("friends", {
  id: serial("id").primaryKey(),
  blogName: varchar("blog_name", { length: 255 }).notNull(),
  blogAddress: varchar("blog_address", { length: 255 }).notNull(),
  pictureAddress: varchar("picture_address", { length: 255 }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export type Friend = typeof friends.$inferSelect;

// ============ Pictures ============
export const pictures = mysqlTable("pictures", {
  id: serial("id").primaryKey(),
  pictureAddress: varchar("picture_address", { length: 255 }),
  pictureName: varchar("picture_name", { length: 255 }),
  pictureDescription: varchar("picture_description", { length: 255 }),
  pictureTime: varchar("picture_time", { length: 255 }),
});

export type Picture = typeof pictures.$inferSelect;

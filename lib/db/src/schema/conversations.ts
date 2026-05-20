import { pgTable, uuid, text, timestamp, jsonb } from "drizzle-orm/pg-core";

export const conversationsTable = pgTable("conversations", {
  id:        uuid("id").primaryKey().defaultRandom(),
  userId:    text("user_id").notNull(),
  title:     text("title").notNull().default("新對話"),
  messages:  jsonb("messages").notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Conversation = typeof conversationsTable.$inferSelect;

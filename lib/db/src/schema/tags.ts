import { pgTable, uuid, text, integer, timestamp, unique } from "drizzle-orm/pg-core";

export const tagsTable = pgTable(
  "tags",
  {
    id:        uuid("id").primaryKey().defaultRandom(),
    userId:    text("user_id").notNull(),
    name:      text("name").notNull(),
    useCount:  integer("use_count").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique().on(t.userId, t.name)]
);

export type Tag = typeof tagsTable.$inferSelect;
export type NewTag = typeof tagsTable.$inferInsert;

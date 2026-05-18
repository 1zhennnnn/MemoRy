import { pgTable, uuid, text, integer, date, timestamp, unique } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const dailyReportsTable = pgTable(
  "daily_reports",
  {
    id:           uuid("id").primaryKey().defaultRandom(),
    userId:       text("user_id").notNull(),
    reportDate:   date("report_date").notNull(),
    keyLearnings: text("key_learnings").array().notNull().default(sql`'{}'::text[]`),
    crossDomain:  text("cross_domain"),
    suggestions:  text("suggestions").array().notNull().default(sql`'{}'::text[]`),
    diaryText:    text("diary_text"),
    noteIds:      text("note_ids").array().notNull().default(sql`'{}'::text[]`),
    noteCount:    integer("note_count").notNull().default(0),
    createdAt:    timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique().on(t.userId, t.reportDate)]
);

export type DailyReport = typeof dailyReportsTable.$inferSelect;
export type NewDailyReport = typeof dailyReportsTable.$inferInsert;

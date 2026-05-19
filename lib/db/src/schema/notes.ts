import { pgTable, uuid, text, timestamp } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { customType } from "drizzle-orm/pg-core";

export const vectorColumn = customType<{
  data: number[];
  driverData: string;
  config: { dimensions: number };
}>({
  dataType(config) {
    return `vector(${config?.dimensions ?? 3072})`;
  },
  toDriver(value) {
    return `[${value.join(",")}]`;
  },
  fromDriver(value) {
    return value
      .replace(/^\[|\]$/g, "")
      .split(",")
      .map(Number);
  },
});

export const notesTable = pgTable("notes", {
  id:          uuid("id").primaryKey().defaultRandom(),
  userId:      text("user_id").notNull(),
  sourceUrl:   text("source_url"),
  sourceTitle: text("source_title"),
  sourceText:  text("source_text"),
  ocrText:     text("ocr_text"),
  aiTitle:     text("ai_title"),
  aiSummary:   text("ai_summary"),
  userNote:    text("user_note"),
  tags:        text("tags").array().notNull().default(sql`'{}'::text[]`),
  noteType:    text("note_type").notNull().default("text"),
  aiStatus:    text("ai_status").notNull().default("pending"),
  embedding:   vectorColumn("embedding", { dimensions: 3072 }),
  createdAt:   timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt:   timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Note = typeof notesTable.$inferSelect;
export type NewNote = typeof notesTable.$inferInsert;

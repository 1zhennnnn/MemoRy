import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: [
    "./src/schema/notes.ts",
    "./src/schema/tags.ts",
    "./src/schema/daily_reports.ts",
  ],
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});

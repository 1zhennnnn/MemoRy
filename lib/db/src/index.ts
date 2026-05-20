import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema/index.js";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL environment variable is not set");
}

const isPgBouncer = connectionString.includes("pgbouncer=true");
const client = postgres(connectionString, {
  max: 10,
  idle_timeout: 60,        // keep connections alive for 60s
  connect_timeout: 5,      // fail fast (don't hang for 10s)
  prepare: !isPgBouncer,
});
export const db = drizzle(client, { schema });

export * from "./schema/index.js";

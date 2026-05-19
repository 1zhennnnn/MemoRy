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
  idle_timeout: 20,        // release idle connections after 20s
  connect_timeout: 10,     // fail fast if can't connect
  prepare: !isPgBouncer,   // PgBouncer transaction mode requires prepare:false
});
export const db = drizzle(client, { schema });

export * from "./schema/index.js";

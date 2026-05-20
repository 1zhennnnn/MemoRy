import pg from "pg";
const { Client } = pg;
const c = new Client({ connectionString: process.env.DATABASE_URL });
await c.connect();
const r = await c.query("SELECT id, highlights FROM notes LIMIT 2");
console.log(JSON.stringify(r.rows));
await c.end();

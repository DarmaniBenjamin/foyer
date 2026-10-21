// The connection to the database, shared by the whole server.
import "../config.js";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema.js";

// DB_SCHEMA: the tables are in their own area of the database instead of
// "public" (migrate.js picks it on hosts that don't allow "public")
export function schemaName() {
  const name = process.env.DB_SCHEMA;
  if (name && !/^[a-z_][a-z0-9_]*$/.test(name))
    throw new Error("DB_SCHEMA can only have small letters, numbers and _.");
  return name;
}

let pool = null;
let database = null;

// Made on first use, after migrate.js has picked the area
export function getDb() {
  if (database) return database;
  const area = schemaName();
  // A "pool" keeps a few connections open and reuses them
  pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    max: Number(process.env.DB_POOL_SIZE) || 5,
    ...(area ? { options: `-c search_path=${area},public` } : {}),
  });
  database = drizzle(pool, { schema });
  return database;
}

// db.select()... anywhere in the server
export const db = new Proxy(
  {},
  { get: (_, name) => Reflect.get(getDb(), name) },
);

export async function closeDb() {
  await pool?.end();
  pool = null;
  database = null;
}

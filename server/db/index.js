// The connection to the database, shared by the whole server.
import { copies, databaseConnection, share } from "../config.js";
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
    ...databaseConnection(),
    // 10 connections, or 24 shared out between several copies of Foyer
    max: Number(process.env.DB_POOL_SIZE) || (copies() > 1 ? share(24, 4) : 10),
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

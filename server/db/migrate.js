// Brings the database up to date: makes the tables on a fresh database,
// then applies any later changes (the files in server/drizzle). Runs
// every time the server starts, so a new deployment updates the database
// by itself. "npm run db:migrate" runs it on its own.
//
// Where the tables go: normally the database's "public" area. On newer
// PostgreSQL (15+) a database user that doesn't own the database often
// isn't allowed to make tables there, even with all privileges (common
// on shared hosting). Then they go in their own area, "foyer". DB_SCHEMA
// can also be set by hand.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import pg from "pg";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { getDb, schemaName } from "./index.js";
import { explainDatabaseError } from "../config.js";

const FOLDER = path.resolve(import.meta.dirname, "../drizzle");

async function pickSchema() {
  if (process.env.DB_SCHEMA) return;
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const {
      rows: [r],
    } = await client.query(
      `select has_schema_privilege(current_user, 'public', 'CREATE') as can,
              exists (select 1 from pg_namespace where nspname = 'foyer') as has`,
    );
    if (r.has || !r.can) {
      await client.query("create schema if not exists foyer");
      process.env.DB_SCHEMA = "foyer";
      console.log('Tables are in the database\'s "foyer" area.');
    }
  } finally {
    await client.end();
  }
}

// The migration files name the "public" area; with DB_SCHEMA a copy
// naming that area is used instead
function migrationsFolder() {
  const area = schemaName();
  if (!area) return FOLDER;
  const copy = fs.mkdtempSync(path.join(os.tmpdir(), "foyer-migrations-"));
  fs.cpSync(FOLDER, copy, { recursive: true });
  for (const file of fs.readdirSync(copy).filter((f) => f.endsWith(".sql"))) {
    const where = path.join(copy, file);
    fs.writeFileSync(
      where,
      fs.readFileSync(where, "utf8").replaceAll('"public".', `"${area}".`),
    );
  }
  return copy;
}

// Throws an error in plain words if it can't
export async function migrateDatabase() {
  if (!process.env.DATABASE_URL)
    throw new Error(explainDatabaseError(new Error("no database")));
  try {
    await pickSchema();
    const area = schemaName();
    await migrate(getDb(), {
      migrationsFolder: migrationsFolder(),
      // Drizzle's own record of which updates are done
      migrationsSchema: area || "drizzle",
    });
  } catch (err) {
    // Drizzle wraps the database's own error (err.cause), which says why
    throw new Error(explainDatabaseError(err.cause ?? err), { cause: err });
  }
  console.log("✓ Database is up to date");
}

// "npm run db:migrate"
if (process.argv[1] && path.resolve(process.argv[1]) === import.meta.filename) {
  const { closeDb } = await import("./index.js");
  try {
    await migrateDatabase();
  } catch (err) {
    console.error(err.message);
    process.exitCode = 1;
  } finally {
    await closeDb();
  }
}

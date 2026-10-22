// GET /api/health/details (signed in): which database and which area
// ("schema") this copy of the app is really using, and how many rows
// each copy of the tables has. For finding out why saved things
// disappear (e.g. two copies of the app using different areas).
import { sql } from "drizzle-orm";
import { db } from "./db/index.js";

const one = async (query) => (await db.execute(query)).rows[0];

export async function healthDetails(req, res) {
  const where = await one(sql`
    select current_database() as database,
           current_user as "user",
           current_schema() as schema,
           current_setting('search_path') as "searchPath",
           inet_server_addr()::text as "serverAddress",
           inet_server_port() as "serverPort",
           current_setting('server_version') as version`);
  // Every area that has Foyer's tables, with how many rows are in each
  const areas = (
    await db.execute(sql`select schemaname from pg_tables where tablename = 'sites' order by schemaname`)
  ).rows.map((r) => r.schemaname);
  const tables = {};
  for (const area of areas) {
    const counts = await one(
      sql.raw(`select
        (select count(*) from "${area}".sites)::int as sites,
        (select count(*) from "${area}".controllers)::int as controllers,
        (select count(*) from "${area}".users)::int as users`),
    );
    tables[area] = counts;
  }
  res.json({
    copy: process.pid,
    upSeconds: Math.round(process.uptime()),
    dbHostSetting: process.env.DB_HOST || "(not set: localhost)",
    dbSchemaSetting: process.env.DB_SCHEMA || "(not set)",
    ...where,
    tables,
  });
}

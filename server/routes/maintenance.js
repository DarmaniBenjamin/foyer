// /api/maintenance: the Maintenance page (admins only).
//   GET  /health   the server, the database and the controllers at a glance
//   PUT  /mode     maintenance mode for some or all sites
//   POST /cleanup  old guest data: how much there is ({ check: true }),
//                  or delete it
//   GET  /backup   everything in the database as one JSON file
import { Router } from "express";
import { count, inArray, lt, sql } from "drizzle-orm";
import { db, schemaName } from "../db/index.js";
import {
  ads,
  connections,
  controllers,
  guests,
  sites,
  users,
  vouchers,
  whitelist,
} from "../db/schema.js";
import { requireAccess } from "../auth.js";
import { Problem, controllerOut, siteOut, text, whole } from "../shapes.js";

export const maintenanceRouter = Router();
maintenanceRouter.use(requireAccess("maintenance"));

const STARTED = Date.now();
const MAINTENANCE_MODES = ["off", "notice", "open"];

maintenanceRouter.get("/health", async (req, res) => {
  const started = Date.now();
  const {
    rows: [db1],
  } = await db.execute(
    sql`select version() as version, pg_database_size(current_database()) as size`,
  );
  const took = Date.now() - started;
  const counted = async (table) => (await db.select({ n: count() }).from(table))[0].n;
  res.json({
    server: {
      startedAt: STARTED,
      node: process.version,
      memoryMb: Math.round(process.memoryUsage().rss / 1024 / 1024),
    },
    database: {
      ok: true,
      answeredInMs: took,
      version: String(db1.version).split(" on ")[0],
      sizeBytes: Number(db1.size),
      area: schemaName() || "public",
    },
    counts: {
      sites: await counted(sites),
      guests: await counted(guests),
      connections: await counted(connections),
      vouchers: await counted(vouchers),
      whitelist: await counted(whitelist),
      ads: await counted(ads),
      users: await counted(users),
    },
    controllers: (await db.select().from(controllers)).map(controllerOut),
  });
});

// { siteIds: [1, 2] or "all", mode: "off" | "notice" | "open", message }
// notice: guests see a "Wi-Fi under maintenance" page and can't sign in
// open:   guests are let straight on, without the sign-in page
maintenanceRouter.put("/mode", async (req, res) => {
  const mode = String(req.body?.mode);
  if (!MAINTENANCE_MODES.includes(mode)) throw new Problem("Pick a maintenance mode.");
  const message = text(req.body?.message, 500);
  const ids = req.body?.siteIds === "all" ? null : (req.body?.siteIds ?? []).map(Number);
  if (ids && !ids.length) throw new Problem("Pick at least one site.");
  const rows = await db
    .update(sites)
    .set({
      settings: sql`${sites.settings} || ${JSON.stringify({
        maintenance: { mode, message, since: mode === "off" ? null : Date.now() },
      })}::jsonb`,
    })
    .where(ids ? inArray(sites.id, ids) : sql`true`)
    .returning();
  res.json(rows.map(siteOut));
});

// { months, check } → { connections, guests, before }
// Sign-ins older than that, and guests not seen since then, with what
// they typed. The reports for those months are empty afterwards.
maintenanceRouter.post("/cleanup", async (req, res) => {
  const months = whole(req.body?.months, { min: 1, max: 120 });
  if (!months) throw new Problem("Pick how many months to keep.");
  const before = new Date();
  before.setMonth(before.getMonth() - months);
  const oldConnections = lt(connections.at, before);
  const oldGuests = lt(guests.lastSeenAt, before);
  if (req.body?.check) {
    const [c] = await db.select({ n: count() }).from(connections).where(oldConnections);
    const [g] = await db.select({ n: count() }).from(guests).where(oldGuests);
    return res.json({ connections: c.n, guests: g.n, before: before.getTime() });
  }
  const gone = await db.transaction(async (tx) => {
    const c = await tx.delete(connections).where(oldConnections).returning({ id: connections.id });
    const g = await tx.delete(guests).where(oldGuests).returning({ id: guests.id });
    return { connections: c.length, guests: g.length };
  });
  res.json({ ...gone, before: before.getTime() });
});

// Everything except who is signed in right now. Passwords stay scrambled
// (people) or locked with SECRET_KEY (controllers), so restoring needs
// the same SECRET_KEY. Keep the file somewhere safe: it has guests'
// details in it.
maintenanceRouter.get("/backup", async (req, res) => {
  const tables = { users, controllers, sites, vouchers, whitelist, ads, guests, connections };
  const out = { app: "Foyer", version: 1, madeAt: new Date().toISOString(), tables: {} };
  for (const [name, table] of Object.entries(tables))
    out.tables[name] = await db.select().from(table).orderBy(table.id);
  const day = new Date().toISOString().slice(0, 10);
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Content-Disposition", `attachment; filename="foyer-backup-${day}.json"`);
  res.send(JSON.stringify(out));
});
